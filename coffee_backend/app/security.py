# Băm mật khẩu pbkdf2 + token phiên — chỉ dùng thư viện chuẩn
import hashlib
import secrets

ITERATIONS = 100_000


def hash_password(password: str) -> tuple[str, str]:
    """Trả về (salt_hex, hash_hex)."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS)
    return salt, digest.hex()


def verify_password(password: str, salt_hex: str, expected_hex: str) -> bool:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), ITERATIONS)
    return secrets.compare_digest(digest.hex(), expected_hex)


def new_token() -> str:
    return secrets.token_hex(32)


def new_order_code() -> str:
    return f"CH-{secrets.randbelow(900000) + 100000}"


def new_booking_code() -> str:
    return f"BK-{secrets.randbelow(900000) + 100000}"
