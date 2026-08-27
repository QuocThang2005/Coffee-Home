import json

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..menu import load_menu, slugify
from ._common import require_admin
from ._schemas import ProductIn, ProductPatch

router = APIRouter()


@router.post("/products")
def create_product(body: ProductIn, _=Depends(require_admin)):
    menu = load_menu()
    if body.category not in {c["id"] for c in menu["categories"]}:
        raise HTTPException(422, f"Nhóm không hợp lệ — phải thuộc {[c['id'] for c in menu['categories']]}")

    slug = slugify(body.name)
    existing = {p["slug"] for p in menu["products"]}
    n = 2
    while slug in existing:
        slug = f"{slugify(body.name)}-{n}"
        n += 1

    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO products (slug, name, category_id, base_price, discount_pct, "
            "rating, sold, tags, image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (slug, body.name.strip(), body.category, body.basePrice,
             body.discountPct, body.rating, body.sold,
             json.dumps(body.tags, ensure_ascii=False),
             body.image or "/images/logo.svg", body.desc.strip()),
        )
        conn.commit()
        pid = cur.lastrowid

    product = {
        "id": pid, "slug": slug, "name": body.name.strip(),
        "category": body.category, "basePrice": body.basePrice,
        "discountPct": body.discountPct, "rating": body.rating,
        "sold": body.sold, "tags": body.tags,
        "image": body.image or "/images/logo.svg", "desc": body.desc.strip(),
    }
    return {"ok": True, "product": product}


@router.patch("/products/{slug}")
def update_product(slug: str, body: ProductPatch, _=Depends(require_admin)):
    menu = load_menu()
    product = next((p for p in menu["products"] if p["slug"] == slug), None)
    if not product:
        raise HTTPException(404, f"Không tìm thấy món {slug}")
    if body.category and body.category not in {c["id"] for c in menu["categories"]}:
        raise HTTPException(422, "Nhóm không hợp lệ")

    changes = body.model_dump(exclude_unset=True)
    db_map = {
        "name": "name", "category": "category_id",
        "basePrice": "base_price", "discountPct": "discount_pct",
        "desc": "description", "image": "image",
    }
    set_clauses, params = [], []
    for fe_key, db_key in db_map.items():
        if fe_key in changes and changes[fe_key] is not None:
            val = changes[fe_key].strip() if isinstance(changes[fe_key], str) else changes[fe_key]
            set_clauses.append(f"{db_key} = ?")
            params.append(val)
    if "tags" in changes and changes["tags"] is not None:
        set_clauses.append("tags = ?")
        params.append(json.dumps(changes["tags"], ensure_ascii=False))
    if not set_clauses:
        return {"ok": True, "product": product}
    params.append(slug)
    with get_conn() as conn:
        conn.execute(f"UPDATE products SET {', '.join(set_clauses)} WHERE slug = ?", params)

    product.update({k: changes[k] for k in changes if changes[k] is not None})
    return {"ok": True, "product": product}


@router.delete("/products/{slug}")
def delete_product(slug: str, _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE products SET active = 0 WHERE slug = ? AND active = 1", (slug,))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy món {slug}")
    return {"ok": True, "deleted": slug}
