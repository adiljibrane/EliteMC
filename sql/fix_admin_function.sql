-- Fix the is_admin() function to check the correct JWT path
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check app_metadata.is_admin from JWT claims
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'is_admin')::boolean,
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
