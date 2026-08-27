-- Migration 002: Add product rating index
-- Created: 2026-08-26
-- Description: Add index on products.rating for faster sorting

CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);
