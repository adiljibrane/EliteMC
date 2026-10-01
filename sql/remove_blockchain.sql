-- =====================================================
-- EliteMC Cooperative - Remove Polkadot / blockchain layer
--
-- ONLY for databases created from the old schema.sql (with token tables).
-- Fresh installs already use the new schema.sql and must NOT run this.
--
-- Run order on an existing database:
--   membership.sql -> remove_blockchain.sql -> purchase.sql
--
-- Share ownership stays in property_allocations (the cap table).
-- Status changes:
--   properties:  DRAFT, OPEN, READY_TO_MINT, MINTED, CLOSED -> DRAFT, OPEN, FUNDED, CLOSED
--   allocations: RESERVED, SETTLED_OFFCHAIN, ONCHAIN_SETTLED, REVOKED -> RESERVED, SETTLED, REVOKED
-- The whole migration runs in one transaction: it applies fully or not at all.
-- =====================================================

BEGIN;

-- Refuse to run if anything was actually put on-chain: that data must be
-- exported and reviewed by a person first, not silently dropped.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM token_mint_batches)
       OR EXISTS (SELECT 1 FROM token_transfers)
       OR EXISTS (SELECT 1 FROM properties WHERE asset_hub_asset_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM property_allocations
                  WHERE status = 'ONCHAIN_SETTLED' OR onchain_tx_hash IS NOT NULL) THEN
        RAISE EXCEPTION 'On-chain data exists (mint batches, transfers, asset IDs or on-chain allocations). Export it before running this migration.';
    END IF;
END $$;

-- Objects that depend on the status columns must be dropped before the type change
DROP VIEW IF EXISTS property_summary;
DROP VIEW IF EXISTS user_portfolios;
DROP POLICY IF EXISTS "Anyone can view open properties" ON properties;
DROP POLICY IF EXISTS "Admins can delete draft properties" ON properties;

-- Token tables and blockchain columns
DROP TABLE token_transfers;
DROP TABLE token_mint_batches;
DROP TYPE mint_batch_status_enum;

ALTER TABLE properties DROP COLUMN asset_hub_asset_id, DROP COLUMN decimals;
ALTER TABLE property_allocations DROP COLUMN onchain_tx_hash, DROP COLUMN onchain_block;
ALTER TABLE profiles DROP COLUMN wallet_ss58;

-- Property statuses
ALTER TYPE property_status_enum RENAME TO property_status_enum_old;
CREATE TYPE property_status_enum AS ENUM ('DRAFT', 'OPEN', 'FUNDED', 'CLOSED');
ALTER TABLE properties
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE property_status_enum USING (
        CASE status::text
            WHEN 'READY_TO_MINT' THEN 'FUNDED'
            WHEN 'MINTED' THEN 'FUNDED'
            ELSE status::text
        END
    )::property_status_enum,
    ALTER COLUMN status SET DEFAULT 'DRAFT';
DROP TYPE property_status_enum_old;

-- Allocation statuses
ALTER TYPE allocation_status_enum RENAME TO allocation_status_enum_old;
CREATE TYPE allocation_status_enum AS ENUM ('RESERVED', 'SETTLED', 'REVOKED');
ALTER TABLE property_allocations
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE allocation_status_enum USING (
        CASE status::text
            WHEN 'SETTLED_OFFCHAIN' THEN 'SETTLED'
            ELSE status::text
        END
    )::allocation_status_enum,
    ALTER COLUMN status SET DEFAULT 'RESERVED';
DROP TYPE allocation_status_enum_old;

-- Recreate policies and views (same as the new schema.sql)
CREATE POLICY "Anyone can view open properties"
    ON properties FOR SELECT
    USING (status = 'OPEN' OR is_admin());

CREATE POLICY "Admins can delete draft properties"
    ON properties FOR DELETE
    USING (is_admin() AND status = 'DRAFT');

CREATE OR REPLACE VIEW property_summary AS
SELECT
    p.id,
    p.title,
    p.location,
    p.price_per_lot,
    p.total_lots,
    p.target_raise_mur,
    p.status,
    COALESCE(SUM(pa.lots), 0)::INTEGER AS lots_sold,
    COALESCE(SUM(pa.lots * p.price_per_lot), 0) AS amount_raised,
    p.created_at,
    p.updated_at
FROM properties p
LEFT JOIN property_allocations pa ON p.id = pa.property_id
    AND pa.status IN ('RESERVED', 'SETTLED')
GROUP BY p.id;

CREATE OR REPLACE VIEW user_portfolios AS
SELECT
    pa.user_id,
    pa.property_id,
    p.title AS property_title,
    p.location AS property_location,
    SUM(pa.lots) AS total_lots,
    p.price_per_lot,
    SUM(pa.lots * p.price_per_lot) AS total_invested,
    pa.status AS allocation_status,
    p.status AS property_status
FROM property_allocations pa
JOIN properties p ON pa.property_id = p.id
WHERE pa.status IN ('RESERVED', 'SETTLED')
GROUP BY pa.user_id, pa.property_id, p.title, p.location, p.price_per_lot, pa.status, p.status;

COMMIT;
