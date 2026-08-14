/*
# Inventory RPC Functions & Triggers
Provides atomic database stored procedures for stock adjustment and stock transfer between warehouses.
*/

-- 1. Function: Adjust Inventory Level
CREATE OR REPLACE FUNCTION adjust_inventory_level(
    p_product_id UUID,
    p_variant_id UUID DEFAULT NULL,
    p_warehouse_id UUID DEFAULT NULL,
    p_qty_change INT DEFAULT 0,
    p_movement_type TEXT DEFAULT 'manual_adjustment',
    p_ref TEXT DEFAULT NULL,
    p_actor TEXT DEFAULT 'Admin',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_qty INT := 0;
    v_new_qty INT := 0;
    v_total_product_stock INT := 0;
    v_level_id UUID;
BEGIN
    IF p_warehouse_id IS NULL THEN
        SELECT id INTO p_warehouse_id FROM warehouses WHERE is_main = true LIMIT 1;
        IF p_warehouse_id IS NULL THEN
            SELECT id INTO p_warehouse_id FROM warehouses LIMIT 1;
        END IF;
    END IF;

    IF p_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No warehouse specified or available');
    END IF;

    -- Lock & Fetch current stock
    IF p_variant_id IS NULL THEN
        SELECT id, quantity INTO v_level_id, v_prev_qty
        FROM inventory_levels
        WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id AND variant_id IS NULL
        FOR UPDATE;
    ELSE
        SELECT id, quantity INTO v_level_id, v_prev_qty
        FROM inventory_levels
        WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id AND variant_id = p_variant_id
        FOR UPDATE;
    END IF;

    IF v_prev_qty IS NULL THEN
        v_prev_qty := 0;
    END IF;

    v_new_qty := GREATEST(0, v_prev_qty + p_qty_change);

    -- Upsert inventory level
    IF v_level_id IS NOT NULL THEN
        UPDATE inventory_levels
        SET quantity = v_new_qty, updated_at = now()
        WHERE id = v_level_id;
    ELSE
        INSERT INTO inventory_levels (product_id, variant_id, warehouse_id, quantity)
        VALUES (p_product_id, p_variant_id, p_warehouse_id, v_new_qty);
    END IF;

    -- Record movement
    INSERT INTO inventory_movements (
        product_id,
        variant_id,
        warehouse_id,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        reference_number,
        created_by,
        notes,
        created_at
    ) VALUES (
        p_product_id,
        p_variant_id,
        p_warehouse_id,
        p_movement_type,
        p_qty_change,
        v_prev_qty,
        v_new_qty,
        COALESCE(p_ref, 'ADJ-' || floor(random()*899999 + 100000)::text),
        COALESCE(p_actor, 'Admin'),
        COALESCE(p_notes, ''),
        now()
    );

    -- Sync total stock to products table
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_product_stock
    FROM inventory_levels
    WHERE product_id = p_product_id;

    UPDATE products
    SET stock_quantity = v_total_product_stock, updated_at = now()
    WHERE id = p_product_id;

    RETURN jsonb_build_object('success', true, 'new_stock', v_new_qty, 'total_stock', v_total_product_stock);
END;
$$;


-- 2. Function: Transfer Inventory Between Warehouses
CREATE OR REPLACE FUNCTION transfer_inventory_between_warehouses(
    p_product_id UUID,
    p_variant_id UUID DEFAULT NULL,
    p_from_warehouse_id UUID DEFAULT NULL,
    p_to_warehouse_id UUID DEFAULT NULL,
    p_transfer_qty INT DEFAULT 0,
    p_actor TEXT DEFAULT 'Admin',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_qty INT := 0;
    v_ref TEXT;
    v_res1 JSONB;
    v_res2 JSONB;
BEGIN
    IF p_transfer_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transfer quantity must be greater than zero');
    END IF;

    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source and destination warehouses cannot be the same');
    END IF;

    -- Check source stock
    IF p_variant_id IS NULL THEN
        SELECT COALESCE(quantity, 0) INTO v_source_qty
        FROM inventory_levels
        WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id AND variant_id IS NULL;
    ELSE
        SELECT COALESCE(quantity, 0) INTO v_source_qty
        FROM inventory_levels
        WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id AND variant_id = p_variant_id;
    END IF;

    IF v_source_qty < p_transfer_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient stock in source warehouse. Available: ' || v_source_qty || ', Requested: ' || p_transfer_qty
        );
    END IF;

    v_ref := 'TRF-' || floor(random()*899999 + 100000)::text;

    -- Deduct from source
    v_res1 := adjust_inventory_level(
        p_product_id := p_product_id,
        p_variant_id := p_variant_id,
        p_warehouse_id := p_from_warehouse_id,
        p_qty_change := -p_transfer_qty,
        p_movement_type := 'transfer_out',
        p_ref := v_ref,
        p_actor := p_actor,
        p_notes := COALESCE(p_notes, '') || ' [Transfer Out]'
    );

    -- Add to destination
    v_res2 := adjust_inventory_level(
        p_product_id := p_product_id,
        p_variant_id := p_variant_id,
        p_warehouse_id := p_to_warehouse_id,
        p_qty_change := p_transfer_qty,
        p_movement_type := 'transfer_in',
        p_ref := v_ref,
        p_actor := p_actor,
        p_notes := COALESCE(p_notes, '') || ' [Transfer In]'
    );

    RETURN jsonb_build_object('success', true, 'reference', v_ref);
END;
$$;
