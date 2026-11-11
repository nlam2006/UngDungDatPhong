from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from email.message import EmailMessage
import smtplib
import os


# =========================================================
# LOAD FILE .ENV
# =========================================================

load_dotenv()


# =========================================================
# ĐƯỜNG DẪN PROJECT
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# =========================================================
# FLASK
# =========================================================

app = Flask(__name__)
CORS(app)


# =========================================================
# TRANG CHỦ
# =========================================================

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


# =========================================================
# CSS
# =========================================================

@app.route("/style.css")
def style():
    return send_from_directory(BASE_DIR, "style.css")


# =========================================================
# JAVASCRIPT
# =========================================================

@app.route("/script.js")
def script():
    return send_from_directory(BASE_DIR, "script.js")


# =========================================================
# GỬI EMAIL XÁC NHẬN ĐẶT PHÒNG
# =========================================================

@app.route("/api/send-confirmation-email", methods=["POST"])
def send_confirmation_email():

    try:

        # -------------------------------------------------
        # LẤY DỮ LIỆU TỪ JAVASCRIPT
        # -------------------------------------------------

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "message": "Không nhận được dữ liệu đặt phòng."
            }), 400


        # -------------------------------------------------
        # THÔNG TIN KHÁCH HÀNG
        # -------------------------------------------------

        customer_name = str(
            data.get("customerName", "")
        ).strip()

        customer_phone = str(
            data.get("customerPhone", "")
        ).strip()

        customer_email = str(
            data.get("customerEmail", "")
        ).strip().lower()


        # -------------------------------------------------
        # THÔNG TIN ĐẶT PHÒNG
        # -------------------------------------------------

        booking_id = data.get("id", "")

        room_number = data.get(
            "roomNumber",
            ""
        )

        room_type = data.get(
            "roomType",
            ""
        )

        check_in = data.get(
            "checkIn",
            data.get("checkin", "")
        )

        check_out = data.get(
            "checkOut",
            data.get("checkout", "")
        )

        nights = data.get(
            "nights",
            0
        )

        total = data.get(
            "total",
            0
        )


        # -------------------------------------------------
        # KIỂM TRA EMAIL
        # -------------------------------------------------

        if not customer_name:
            return jsonify({
                "success": False,
                "message": "Thiếu tên khách hàng."
            }), 400


        if not customer_email:
            return jsonify({
                "success": False,
                "message": "Thiếu email khách hàng."
            }), 400


        # -------------------------------------------------
        # GMAIL CỦA HAVEN HOTEL
        # -------------------------------------------------

        gmail_user = os.getenv(
            "GMAIL_USER"
        )

        gmail_password = os.getenv(
            "GMAIL_APP_PASSWORD"
        )


        if not gmail_user or not gmail_password:

            return jsonify({
                "success": False,
                "message": "Chưa cấu hình Gmail. Vui lòng kiểm tra biến môi trường."
            }), 500


        # -------------------------------------------------
        # ĐỊNH DẠNG TIỀN
        # -------------------------------------------------

        try:

            total_number = int(
                float(total)
            )

            total_display = (
                f"{total_number:,} VNĐ"
            )

        except Exception:

            total_display = (
                f"{total} VNĐ"
            )


        # -------------------------------------------------
        # TẠO EMAIL
        # -------------------------------------------------

        msg = EmailMessage()

        msg["Subject"] = (
            f"Haven Hotel - Xác nhận đặt phòng #{booking_id}"
        )

        # Gmail của Haven Hotel
        msg["From"] = gmail_user

        # Gmail mà khách đã đăng ký tài khoản
        msg["To"] = customer_email


        # -------------------------------------------------
        # NỘI DUNG EMAIL
        # -------------------------------------------------

        email_content = f"""
Xin chào {customer_name},

Cảm ơn bạn đã đặt phòng tại Haven Hotel.

========================================
        XÁC NHẬN ĐẶT PHÒNG
========================================

Mã đặt phòng: {booking_id}

Phòng: {room_number}
Loại phòng: {room_type}

Ngày nhận phòng: {check_in}
Ngày trả phòng: {check_out}

Số đêm: {nights}
Tổng tiền: {total_display}


========================================
        THÔNG TIN KHÁCH HÀNG
========================================

Họ tên: {customer_name}
Số điện thoại: {customer_phone}
Email: {customer_email}


========================================

Cảm ơn bạn đã lựa chọn Haven Hotel.

Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với Haven Hotel để được hỗ trợ.

Trân trọng,

HAVEN HOTEL
"""


        msg.set_content(
            email_content
        )


        # -------------------------------------------------
        # KẾT NỐI GMAIL SMTP
        # -------------------------------------------------

        with smtplib.SMTP_SSL(
            "smtp.gmail.com",
            465,
            timeout=30
        ) as smtp:

            smtp.login(
                gmail_user,
                gmail_password
            )

            smtp.send_message(
                msg
            )


        # -------------------------------------------------
        # THÀNH CÔNG
        # -------------------------------------------------

        print(
            f"Đã gửi email xác nhận đến: {customer_email}"
        )

        return jsonify({
            "success": True,
            "message": "Email xác nhận đã được gửi thành công."
        })


    # =====================================================
    # LỖI ĐĂNG NHẬP GMAIL
    # =====================================================

    except smtplib.SMTPAuthenticationError:

        print(
            "LỖI: Gmail đăng nhập thất bại."
        )

        return jsonify({
            "success": False,
            "message": "Không thể đăng nhập Gmail. Hãy kiểm tra Gmail App Password."
        }), 500


    # =====================================================
    # LỖI SMTP
    # =====================================================

    except smtplib.SMTPException as e:

        print(
            "LỖI SMTP:",
            e
        )

        return jsonify({
            "success": False,
            "message": "Không thể gửi email."
        }), 500


    # =====================================================
    # LỖI KHÁC
    # =====================================================

    except Exception as e:

        print(
            "LỖI HỆ THỐNG:",
            e
        )

        return jsonify({
            "success": False,
            "message": "Có lỗi xảy ra khi gửi email."
        }), 500


# =========================================================
# KIỂM TRA SERVER
# =========================================================

@app.route("/api/health")
def health():

    return jsonify({
        "success": True,
        "message": "Haven Hotel Backend đang hoạt động."
    })


# =========================================================
# CHẠY SERVER
# =========================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )