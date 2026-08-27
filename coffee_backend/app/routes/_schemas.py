from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any, Literal


class CustomerIn(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""


class OrderItemIn(BaseModel):
    id: str
    slug: str = ""
    name: str
    qty: int = Field(gt=0, le=99)
    unitPrice: float = Field(ge=0)
    size: str = "M"
    ice: str = ""
    sugar: str = ""
    toppings: list[dict[str, Any]] = []


class OrderIn(BaseModel):
    customer: CustomerIn
    method: Literal["pickup", "delivery"]
    branchId: str = ""
    address: str = ""
    items: list[OrderItemIn] = Field(min_length=1)
    subtotal: float = Field(ge=0)
    shipFee: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)
    total: float = Field(gt=0)
    voucherCode: str = ""
    note: str = ""
    tableId: str = ""
    paymentMethod: str = ""

    @field_validator("address")
    @classmethod
    def delivery_needs_address(cls, v: str, info) -> str:
        if info.data.get("method") == "delivery" and not v.strip():
            raise ValueError("Đơn giao hàng cần địa chỉ")
        return v


class BookingIn(BaseModel):
    branchId: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=20)
    name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^\d{9,12}$")
    email: str = ""
    note: str = ""


class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthIn(BaseModel):
    credential: str = Field(min_length=20)


class ApplicationIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^\d{9,12}$")
    email: str = ""
    position: str = Field(min_length=2)
    note: str = ""

    @field_validator("email")
    @classmethod
    def email_optional(cls, v: str) -> str:
        v = v.strip()
        if v and "@" not in v:
            raise ValueError("Email không hợp lệ")
        return v


class FeedbackIn(BaseModel):
    name: str = Field(min_length=2)
    contact: str = Field(default="", max_length=120)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=5, max_length=1000)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nội dung phản hồi không được để trống")
        return v.strip()


class ReplyIn(BaseModel):
    reply: str = Field(max_length=1000)


class ProductIn(BaseModel):
    name: str = Field(min_length=2)
    category: str = Field(min_length=2)
    basePrice: float = Field(ge=0)
    discountPct: int = Field(default=0, ge=0, le=90)
    desc: str = ""
    image: str = ""
    tags: list[str] = []
    sold: int = Field(default=0, ge=0)
    rating: float = Field(default=4.5, ge=0, le=5)


class ProductPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    category: str | None = None
    basePrice: float | None = Field(default=None, ge=0)
    discountPct: int | None = Field(default=None, ge=0, le=90)
    desc: str | None = None
    image: str | None = None
    tags: list[str] | None = None


class VoucherIn(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    title: str = Field(min_length=2)
    desc: str = ""
    type: Literal["percent", "fixed", "freeship", "gift"]
    value: float = Field(default=0, ge=0)
    minOrder: float = Field(default=0, ge=0)
    until: str = ""

    @field_validator("code")
    @classmethod
    def upper_code(cls, v: str) -> str:
        return v.strip().upper()


class VoucherPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2)
    desc: str | None = None
    type: Literal["percent", "fixed", "freeship", "gift"] | None = None
    value: float | None = Field(default=None, ge=0)
    minOrder: float | None = Field(default=None, ge=0)
    until: str | None = None


class ChatIn(BaseModel):
    messages: list[dict[str, str]] = Field(min_length=1, max_length=20)


class ReviewIn(BaseModel):
    productId: int
    orderCode: str = ""
    rating: int = Field(ge=1, le=5)
    title: str = ""
    message: str = Field(min_length=5, max_length=2000)


class SettingsIn(BaseModel):
    settings: dict[str, str]


class RedeemRewardIn(BaseModel):
    rewardId: int
