-- Insertar items
INSERT INTO inventory_item (id, sku, name, category, "minStock") VALUES
(gen_random_uuid(), 'SKU001', 'Laptop Dell XPS', 'Electronica', 5),
(gen_random_uuid(), 'SKU002', 'Monitor LG 24', 'Perifericos', 10),
(gen_random_uuid(), 'SKU003', 'Teclado Mecanico', 'Perifericos', 20),
(gen_random_uuid(), 'SKU004', 'Mouse Logitech', 'Perifericos', 30),
(gen_random_uuid(), 'SKU005', 'Cable HDMI', 'Accesorios', 50);

-- Insertar stocks
INSERT INTO inventory_stock (id, "itemId", "warehouseId", quantity)
SELECT
  gen_random_uuid(),
  i.id,
  w.id,
  floor(random() * 100 + 20)::integer
FROM inventory_item i, warehouse w;
