-- =====================================================
-- EliteMC Cooperative - Atomic Lot Purchase
-- Run AFTER membership.sql.
--
-- Replaces the old two-step flow (client inserts order -> capture_order
-- Edge Function makes 4 separate writes). purchase_lots() does everything
-- in ONE transaction, so a purchase either fully happens or not at all:
--   * member must be ACTIVE
--   * property row is locked, so concurrent buyers cannot oversell
--   * wallet row is locked, so concurrent purchases cannot overspend
--   * order (PAID), wallet debit, ledger, allocation and audit are written together
--   * an idempotency key makes retries / double taps safe
-- Lock order is always property -> wallet, so concurrent calls cannot deadlock.
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency
    ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Orders are now created only by purchase_lots(), never directly by clients
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;

CREATE OR REPLACE FUNCTION purchase_lots(
    p_property_id UUID,
    p_lots INTEGER,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_property properties;
    v_balance fiat_balances;
    v_existing_order orders;
    v_lots_sold INTEGER;
    v_lots_available INTEGER;
    v_total NUMERIC(18,2);
    v_order_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_lots IS NULL OR p_lots <= 0 THEN
        RAISE EXCEPTION 'Number of lots must be greater than zero';
    END IF;

    IF NOT is_active_member(v_uid) THEN
        RAISE EXCEPTION 'Only active cooperative members can purchase lots';
    END IF;

    -- Lock 1: property (serialises all purchases of this property)
    SELECT * INTO v_property FROM properties WHERE id = p_property_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    -- Retry of a purchase that already succeeded: return it, don't charge twice.
    -- Checked after the property lock so two simultaneous retries are serialised.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_order FROM orders
        WHERE user_id = v_uid AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'order_id', v_existing_order.id,
                'lots', v_existing_order.lots,
                'total_mur', v_existing_order.total_price_mur,
                'already_processed', true
            );
        END IF;
    END IF;

    IF v_property.status <> 'OPEN' THEN
        RAISE EXCEPTION 'Property is not open for purchase';
    END IF;
    IF p_lots < v_property.min_lot_purchase THEN
        RAISE EXCEPTION 'Minimum purchase is % lot(s)', v_property.min_lot_purchase;
    END IF;

    SELECT COALESCE(SUM(lots), 0) INTO v_lots_sold
    FROM property_allocations
    WHERE property_id = p_property_id
      AND status IN ('RESERVED', 'SETTLED_OFFCHAIN', 'ONCHAIN_SETTLED');

    v_lots_available := v_property.total_lots - v_lots_sold;
    IF p_lots > v_lots_available THEN
        RAISE EXCEPTION 'Only % lot(s) still available', v_lots_available;
    END IF;

    v_total := v_property.price_per_lot * p_lots;

    -- Lock 2: buyer's wallet
    SELECT * INTO v_balance FROM fiat_balances WHERE user_id = v_uid FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;
    IF v_balance.available < v_total THEN
        RAISE EXCEPTION 'Insufficient balance: MUR % required, MUR % available', v_total, v_balance.available;
    END IF;

    INSERT INTO orders (user_id, property_id, lots, unit_price_mur, status, paid_at, idempotency_key)
    VALUES (v_uid, p_property_id, p_lots, v_property.price_per_lot, 'PAID', NOW(), p_idempotency_key)
    RETURNING id INTO v_order_id;

    UPDATE fiat_balances SET available = available - v_total WHERE user_id = v_uid;

    INSERT INTO fiat_ledger (user_id, direction, amount_mur, reason, ref_table, ref_id)
    VALUES (v_uid, 'DEBIT', v_total,
            format('Purchase of %s lot(s) in %s', p_lots, v_property.title),
            'orders', v_order_id);

    -- One active allocation per member per property: add to it, or create it
    UPDATE property_allocations SET lots = lots + p_lots
    WHERE user_id = v_uid AND property_id = p_property_id AND status = 'RESERVED';

    IF NOT FOUND THEN
        INSERT INTO property_allocations (user_id, property_id, lots, status, order_id)
        VALUES (v_uid, p_property_id, p_lots, 'RESERVED', v_order_id);
    END IF;

    INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (v_uid, 'purchase_lots', 'orders', v_order_id,
            jsonb_build_object('property_id', p_property_id, 'lots', p_lots,
                               'unit_price_mur', v_property.price_per_lot, 'total_mur', v_total,
                               'idempotency_key', p_idempotency_key));

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'lots', p_lots,
        'total_mur', v_total,
        'new_balance_mur', v_balance.available - v_total,
        'lots_remaining', v_lots_available - p_lots,
        'already_processed', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION purchase_lots(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION purchase_lots(UUID, INTEGER, TEXT) TO authenticated;
