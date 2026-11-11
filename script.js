/* =====================================================
   HAVEN HOTEL - script.js (bản đã sửa)
   - Gửi email xác nhận qua Google Apps Script
   - Sửa màn hình loading
   - Hoàn thiện phần Admin (thống kê, thêm/xóa/bảo trì phòng)
   - Chống XSS, thêm tài khoản admin demo, ripple, back-to-top
   ===================================================== */

/* DÁN URL WEB APP APPS SCRIPT CỦA BẠN VÀO ĐÂY */
const URL_APPS_SCRIPT =
    "https://script.google.com/macros/s/AKfycbzAwuRpvHqHw33CSMN71jSRquGQnwCLWwqph9KfPnDTC1zJBn_NaJwqUI_Ls0sy8jjS/exec";

const ADMIN_EMAIL = "admin@havenhotel.vn";

const seedRooms = [
    { id: 101, name: "Standard Garden", type: "Standard", capacity: 2, price: 650000, status: "Trống",
      image: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80" },
    { id: 102, name: "Standard City", type: "Standard", capacity: 2, price: 700000, status: "Trống",
      image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80" },
    { id: 201, name: "Deluxe Balcony", type: "Deluxe", capacity: 2, price: 950000, status: "Trống",
      image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80" },
    { id: 202, name: "Deluxe Ocean", type: "Deluxe", capacity: 3, price: 1150000, status: "Trống",
      image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80" },
    { id: 301, name: "Family Suite", type: "Family", capacity: 4, price: 1450000, status: "Trống",
      image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=900&q=80" },
    { id: 302, name: "Family Premium", type: "Family", capacity: 4, price: 1650000, status: "Trống",
      image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=80" }
];

/* =========================
   DỮ LIỆU (localStorage)
   ========================= */

function load(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

let rooms = load("haven_rooms", seedRooms);
let bookings = load("haven_bookings", []);
let users = load("haven_users", []);
let currentUser = load("haven_current_user", null);

/* Tài khoản admin demo */
if (!users.some(u => u.email === ADMIN_EMAIL)) {
    users.push({
        id: "U0",
        name: "Quản trị viên",
        email: ADMIN_EMAIL,
        phone: "0123456789",
        password: "123456",
        createdAt: new Date().toLocaleString("vi-VN")
    });
    localStorage.setItem("haven_users", JSON.stringify(users));
}

function saveData() {
    localStorage.setItem("haven_rooms", JSON.stringify(rooms));
    localStorage.setItem("haven_bookings", JSON.stringify(bookings));
    localStorage.setItem("haven_users", JSON.stringify(users));
}

/* =========================
   TIỆN ÍCH
   ========================= */

const modal = document.getElementById("modal");
const modalBox = document.getElementById("modalBox");

/* Chống chèn HTML độc hại */
function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function money(v) {
    return Number(v).toLocaleString("vi-VN") + "đ";
}

function dayDiff(start, end) {
    return Math.round((new Date(end) - new Date(start)) / 86400000);
}

function formatDate(d) {
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function isAdmin() {
    return !!currentUser && currentUser.email === ADMIN_EMAIL;
}

function sameEmail(a, b) {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

let toastTimer;
function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.innerText = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function openModal(content) {
    if (!modal || !modalBox) return;
    modalBox.innerHTML = content;
    modal.classList.remove("hidden");
}

function closeModal() {
    if (modal) modal.classList.add("hidden");
}

if (modal) {
    modal.addEventListener("click", e => {
        if (e.target === modal) closeModal();
    });
}

function go(id) {
    const target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.target === id);
    });
    target.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================
   PHÒNG
   ========================= */

function roomCard(room, forceAvailable) {
    const available = forceAvailable || room.status === "Trống";
    const label = forceAvailable ? "Trống" : room.status;
    return `
    <div class="room-card">
        <div class="room-image" style="background-image:url('${esc(room.image)}')">
            <span class="room-status ${available ? "available" : "booked"}">${esc(label)}</span>
        </div>
        <div class="room-info">
            <h3>${esc(room.name)}</h3>
            <div class="room-meta">${esc(room.type)} · ${room.capacity} khách · Wi-Fi</div>
            <div class="room-bottom">
                <div class="room-price">${money(room.price)} <span>/ đêm</span></div>
                <div class="room-actions">
                    <button onclick="openRoom(${room.id})">Xem</button>
                    <button class="btn gold" onclick="openBooking(${room.id})" ${available ? "" : "disabled"}>Đặt phòng</button>
                </div>
            </div>
        </div>
    </div>`;
}

function renderRooms() {
    const grid = document.getElementById("roomGrid");
    if (!grid) return;

    let data = [...rooms];
    const type = document.getElementById("typeFilter")?.value || "all";
    const sort = document.getElementById("sortFilter")?.value || "default";

    if (type !== "all") data = data.filter(r => r.type === type);
    if (sort === "low") data.sort((a, b) => a.price - b.price);
    if (sort === "high") data.sort((a, b) => b.price - a.price);

    grid.innerHTML = data.length
        ? data.map(r => roomCard(r)).join("")
        : `<div class="empty">Không tìm thấy phòng phù hợp.</div>`;
}

function hasConflict(roomId, checkin, checkout) {
    const s = new Date(checkin), e = new Date(checkout);
    return bookings.some(b =>
        Number(b.roomId) === Number(roomId) &&
        b.status === "Đã xác nhận" &&
        s < new Date(b.checkout) && e > new Date(b.checkin)
    );
}

function searchRooms() {
    const checkin = document.getElementById("searchIn")?.value;
    const checkout = document.getElementById("searchOut")?.value;
    const guests = Number(document.getElementById("searchGuests")?.value || 1);

    if (!checkin || !checkout) return toast("Vui lòng chọn ngày nhận và trả phòng.");
    if (new Date(checkout) <= new Date(checkin)) return toast("Ngày trả phòng phải sau ngày nhận phòng.");

    const list = rooms.filter(r =>
        r.status !== "Bảo trì" &&
        r.capacity >= guests &&
        !hasConflict(r.id, checkin, checkout)
    );

    const grid = document.getElementById("roomGrid");
    if (grid) {
        grid.innerHTML = list.length
            ? list.map(r => roomCard(r, true)).join("")
            : `<div class="empty">Không có phòng phù hợp trong khoảng thời gian này.</div>`;
    }
    document.getElementById("rooms")?.scrollIntoView({ behavior: "smooth" });
    toast(`Có ${list.length} phòng phù hợp.`);
}

function openRoom(id) {
    const room = rooms.find(r => r.id === id);
    if (!room) return toast("Không tìm thấy phòng.");

    openModal(`
        <div class="modal-header">
            <div><p class="kicker">${esc(room.type)}</p><h2>${esc(room.name)}</h2></div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <img src="${esc(room.image)}" alt="${esc(room.name)}"
             style="width:100%;height:250px;object-fit:cover;border-radius:10px;">
        <div style="margin-top:20px;">
            <p>Phòng dành cho <b>${room.capacity} khách</b>.</p>
            <p>✓ Wi-Fi miễn phí</p>
            <p>✓ Điều hòa</p>
            <p>✓ TV thông minh</p>
            <p>✓ Bữa sáng</p>
            <p>✓ Dọn phòng hàng ngày</p>
            <h3 style="color:#b99455;margin-top:15px;">${money(room.price)} / đêm</h3>
        </div>
        <div class="modal-footer">
            <button class="btn outline" onclick="closeModal()">Đóng</button>
            <button class="btn gold" onclick="closeModal();openBooking(${room.id});">Đặt phòng</button>
        </div>
    `);
}

/* =========================
   ĐĂNG NHẬP / ĐĂNG KÝ
   ========================= */

function openLogin() {
    const m = document.getElementById("authModal");
    if (!m) return;
    m.classList.remove("hidden");
    m.style.display = "flex";
    showLogin();
}

function closeAuthModal() {
    const m = document.getElementById("authModal");
    if (!m) return;
    m.classList.add("hidden");
    m.style.display = "none";
}

function showLogin() {
    const l = document.getElementById("loginForm");
    const r = document.getElementById("registerForm");
    if (l) l.style.display = "block";
    if (r) r.style.display = "none";
}

function showRegister() {
    const l = document.getElementById("loginForm");
    const r = document.getElementById("registerForm");
    if (l) l.style.display = "none";
    if (r) r.style.display = "block";
}

function updateLoginButton() {
    const btn = document.getElementById("loginButton");
    if (!btn) return;
    if (currentUser) {
        btn.textContent = currentUser.name;
        btn.onclick = openUserMenu;
    } else {
        btn.textContent = "Đăng nhập";
        btn.onclick = openLogin;
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setCurrentUser(user) {
    currentUser = { id: user.id, name: user.name, email: user.email, phone: user.phone };
    localStorage.setItem("haven_current_user", JSON.stringify(currentUser));
    updateLoginButton();
    updateAdminVisibility();
    renderBookings();
    renderAdmin();
}

function register() {
    const name = document.getElementById("registerName")?.value.trim() || "";
    const email = (document.getElementById("registerEmail")?.value.trim() || "").toLowerCase();
    const phone = document.getElementById("registerPhone")?.value.trim() || "";
    const password = document.getElementById("registerPassword")?.value || "";
    const password2 = document.getElementById("registerPassword2")?.value || "";

    if (!name) return toast("Vui lòng nhập họ tên.");
    if (!email) return toast("Vui lòng nhập email.");
    if (!isValidEmail(email)) return toast("Email không hợp lệ.");
    if (!phone) return toast("Vui lòng nhập số điện thoại.");
    if (!password) return toast("Vui lòng nhập mật khẩu.");
    if (password.length < 6) return toast("Mật khẩu phải có ít nhất 6 ký tự.");
    if (password !== password2) return toast("Mật khẩu nhập lại không khớp.");
    if (users.some(u => sameEmail(u.email, email))) return toast("Email này đã được đăng ký.");

    const user = {
        id: "U" + Date.now(), name, email, phone, password,
        createdAt: new Date().toLocaleString("vi-VN")
    };
    users.push(user);
    saveData();

    setCurrentUser(user);
    closeAuthModal();
    toast("Đăng ký tài khoản thành công!");
}

function login() {
    const email = (document.getElementById("loginEmail")?.value.trim() || "").toLowerCase();
    const password = document.getElementById("loginPassword")?.value || "";

    if (!email) return toast("Vui lòng nhập email.");
    if (!password) return toast("Vui lòng nhập mật khẩu.");

    const user = users.find(u => sameEmail(u.email, email) && u.password === password);
    if (!user) return toast("Email hoặc mật khẩu không chính xác.");

    setCurrentUser(user);
    closeAuthModal();
    toast(`Xin chào ${user.name}!`);
}

function logout() {
    currentUser = null;
    localStorage.removeItem("haven_current_user");
    updateLoginButton();
    updateAdminVisibility();
    closeModal();
    renderBookings();
    toast("Bạn đã đăng xuất.");
}

function openUserMenu() {
    if (!currentUser) return openLogin();
    openModal(`
        <div class="modal-header">
            <div><p class="kicker">TÀI KHOẢN</p><h2>Xin chào ${esc(currentUser.name)}</h2></div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div style="padding:20px 0;">
            <p><strong>Họ tên:</strong> ${esc(currentUser.name)}</p>
            <p><strong>Email:</strong> ${esc(currentUser.email)}</p>
            <p><strong>Số điện thoại:</strong> ${esc(currentUser.phone || "Chưa cập nhật")}</p>
        </div>
        <div class="modal-footer">
            <button class="btn outline" onclick="closeModal();go('bookings');">Đặt phòng của tôi</button>
            <button class="btn gold" onclick="logout()">Đăng xuất</button>
        </div>
    `);
}

/* =========================
   ĐẶT PHÒNG
   ========================= */

function openBooking(id) {
    if (!currentUser) {
        toast("Vui lòng đăng nhập trước khi đặt phòng.");
        return openLogin();
    }
    const room = rooms.find(r => r.id === id);
    if (!room) return toast("Không tìm thấy phòng.");
    if (room.status === "Bảo trì") return toast("Phòng đang bảo trì.");

    openModal(`
        <div class="modal-header">
            <div><p class="kicker">ĐẶT PHÒNG</p><h2>${esc(room.name)}</h2></div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <div style="display:flex;gap:15px;align-items:center;margin-bottom:20px;padding:15px;border-radius:10px;background:#f8f6f1;">
            <img src="${esc(room.image)}" alt="${esc(room.name)}"
                 style="width:110px;height:80px;object-fit:cover;border-radius:8px;">
            <div>
                <strong>Phòng ${room.id}</strong>
                <div>${esc(room.type)} · ${room.capacity} khách</div>
                <div style="margin-top:5px;font-weight:600;color:#b99455;">${money(room.price)} / đêm</div>
            </div>
        </div>

        <form id="bookingForm" onsubmit="confirmBooking(event, ${room.id})">
            <div class="form-group">
                <label>Họ và tên</label>
                <input id="customerName" type="text" value="${esc(currentUser.name)}" required placeholder="Nguyễn Văn A">
            </div>
            <div class="form-group">
                <label>Số điện thoại</label>
                <input id="customerPhone" type="tel" value="${esc(currentUser.phone || "")}" required placeholder="0987654321">
            </div>
            <div class="form-group">
                <label>Email nhận xác nhận</label>
                <input id="customerEmail" type="email" value="${esc(currentUser.email)}" required readonly>
                <small style="display:block;margin-top:6px;color:#777;">
                    Email nhận xác nhận là email bạn đã đăng ký tài khoản.
                </small>
            </div>

            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;">
                <div class="form-group">
                    <label>Ngày nhận phòng</label>
                    <input id="checkin" type="date" required>
                </div>
                <div class="form-group">
                    <label>Ngày trả phòng</label>
                    <input id="checkout" type="date" required>
                </div>
            </div>

            <div class="form-group">
                <label>Ghi chú</label>
                <textarea id="bookingNote" rows="3" placeholder="Yêu cầu đặc biệt nếu có..."
                          style="width:100%;padding:11px;border:1px solid #ddd;border-radius:7px;font-family:inherit;"></textarea>
            </div>

            <div id="bookingPricePreview"
                 style="padding:15px;margin:15px 0;border-radius:10px;background:#f8f6f1;display:none;"></div>

            <div class="modal-footer">
                <button type="button" class="btn outline" onclick="closeModal()">Hủy</button>
                <button type="submit" id="btnConfirm" class="btn gold">Xác nhận đặt phòng</button>
            </div>
        </form>
    `);

    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const after = new Date(today); after.setDate(today.getDate() + 2);

    const inEl = document.getElementById("checkin");
    const outEl = document.getElementById("checkout");
    inEl.min = formatDate(today);
    inEl.value = formatDate(tomorrow);
    outEl.min = formatDate(tomorrow);
    outEl.value = formatDate(after);

    const updatePreview = () => {
        const preview = document.getElementById("bookingPricePreview");
        if (!preview || !inEl.value || !outEl.value) return;
        const nights = dayDiff(inEl.value, outEl.value);
        if (nights <= 0) { preview.style.display = "none"; return; }
        preview.style.display = "block";
        preview.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;">
                <span>${nights} đêm</span>
                <strong>${money(nights * room.price)}</strong>
            </div>`;
    };

    inEl.addEventListener("change", () => {
        const next = new Date(inEl.value);
        next.setDate(next.getDate() + 1);
        outEl.min = formatDate(next);
        if (outEl.value && outEl.value <= inEl.value) outEl.value = formatDate(next);
        updatePreview();
    });
    outEl.addEventListener("change", updatePreview);
    updatePreview();
}

/* Gửi email xác nhận qua Google Apps Script */
async function sendConfirmationEmail(booking) {
    await fetch(URL_APPS_SCRIPT, {
        method: "POST",
        /* no-cors: gửi được cả khi mở bằng file://, nhưng không đọc được phản hồi */
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            id: booking.id,
            roomNumber: booking.roomNumber,
            roomType: booking.roomType,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            customerEmail: booking.customerEmail,
            checkIn: booking.checkin,
            checkOut: booking.checkout,
            nights: booking.nights,
            total: booking.total
        })
    });
    return true;
}

async function confirmBooking(event, roomId) {
    if (event) event.preventDefault();

    if (!currentUser) {
        toast("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
        closeModal();
        return openLogin();
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) return toast("Không tìm thấy phòng.");

    const name = document.getElementById("customerName")?.value.trim();
    const phone = document.getElementById("customerPhone")?.value.trim();
    const email = String(currentUser.email || "").trim().toLowerCase();
    const checkin = document.getElementById("checkin")?.value;
    const checkout = document.getElementById("checkout")?.value;
    const note = document.getElementById("bookingNote")?.value.trim() || "";

    if (!name) return toast("Vui lòng nhập họ tên.");
    if (!phone) return toast("Vui lòng nhập số điện thoại.");
    if (!email) return toast("Tài khoản chưa có email.");
    if (!checkin || !checkout) return toast("Vui lòng chọn ngày nhận và trả phòng.");

    const nights = dayDiff(checkin, checkout);
    if (nights <= 0) return toast("Ngày trả phòng phải sau ngày nhận phòng.");
    if (hasConflict(room.id, checkin, checkout)) {
        return toast("Phòng đã được đặt trong khoảng thời gian này.");
    }

    const btn = document.getElementById("btnConfirm");
    if (btn) { btn.disabled = true; btn.textContent = "Đang xử lý..."; }

    const booking = {
        id: "HB" + Date.now(),
        roomId: room.id,
        room: room.name,
        roomNumber: room.id,
        roomType: room.type,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        checkin, checkout, nights,
        total: nights * Number(room.price),
        note,
        status: "Đã xác nhận",
        createdAt: new Date().toLocaleString("vi-VN")
    };

    bookings.push(booking);
    syncRoomStatus();
    saveData();
    renderAll();

    openModal(`
        <div style="text-align:center;padding:20px 0;">
            <div style="font-size:55px;margin-bottom:15px;">✓</div>
            <h2>Đặt phòng thành công!</h2>
            <p style="margin-top:10px;color:#666;">Mã đặt phòng của bạn:</p>
            <h3 style="color:#b99455;margin:8px 0 20px;">${esc(booking.id)}</h3>
            <p id="mailStatus">Đang gửi email xác nhận tới:</p>
            <strong>${esc(email)}</strong>
            <div class="modal-footer" style="justify-content:center;">
                <button class="btn outline" onclick="closeModal()">Đóng</button>
            </div>
        </div>
    `);

    const statusEl = document.getElementById("mailStatus");
    try {
        await sendConfirmationEmail(booking);
        if (statusEl) statusEl.textContent = "Đã gửi yêu cầu email xác nhận tới (kiểm tra cả mục Spam):";
        toast("Đã gửi yêu cầu email xác nhận.");
    } catch (error) {
        console.error("Lỗi gửi email:", error);
        if (statusEl) statusEl.textContent = "Không gửi được email tới:";
        toast("Đặt phòng thành công nhưng không thể gửi email.");
    }
}

/* =========================
   ĐẶT PHÒNG CỦA TÔI
   ========================= */

function getMyBookings() {
    if (!currentUser) return [];
    return bookings.filter(b => sameEmail(b.customerEmail, currentUser.email));
}

function renderBookings() {
    const list = document.getElementById("bookingList");
    if (!list) return;

    if (!currentUser) {
        list.innerHTML = `
            <div class="empty" style="text-align:center;padding:40px 20px;">
                <h3>Bạn chưa đăng nhập</h3>
                <p>Vui lòng đăng nhập để xem các đơn đặt phòng.</p>
                <button class="btn gold" onclick="openLogin()" style="margin-top:15px;">Đăng nhập</button>
            </div>`;
        return;
    }

    const mine = getMyBookings().sort((a, b) =>
        Number(String(b.id).replace("HB", "")) - Number(String(a.id).replace("HB", "")));

    if (!mine.length) {
        list.innerHTML = `
            <div class="empty" style="text-align:center;padding:40px 20px;">
                <h3>Chưa có đơn đặt phòng</h3>
                <p>Bạn chưa thực hiện đặt phòng nào.</p>
                <button class="btn gold" onclick="go('rooms')" style="margin-top:15px;">Xem phòng</button>
            </div>`;
        return;
    }

    list.innerHTML = mine.map(b => {
        const status = b.status || "Đã xác nhận";
        const cls = status === "Đã xác nhận" ? "available" : "booked";
        return `
        <div class="booking-card">
            <div class="booking-head">
                <div>
                    <span style="font-size:13px;color:#777;">Mã đặt phòng</span>
                    <h3>${esc(b.id)}</h3>
                </div>
                <span class="room-status ${cls}" style="position:static;">${esc(status)}</span>
            </div>
            <div class="booking-grid">
                <div><small>Phòng</small><br><strong>${esc(b.room)}</strong></div>
                <div><small>Nhận phòng</small><br><strong>${esc(b.checkin)}</strong></div>
                <div><small>Trả phòng</small><br><strong>${esc(b.checkout)}</strong></div>
                <div><small>Số đêm</small><br><strong>${esc(b.nights)}</strong></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:20px;flex-wrap:wrap;">
                <div>
                    <small>Tổng tiền</small>
                    <div style="font-size:20px;font-weight:700;color:#b99455;">${money(b.total)}</div>
                </div>
                <div style="display:flex;gap:10px;">
                    ${status === "Đã xác nhận"
                        ? `<button class="btn outline" onclick="cancelBooking('${esc(b.id)}')">Hủy đặt phòng</button>`
                        : ""}
                    <button class="btn gold" onclick="viewBooking('${esc(b.id)}')">Chi tiết</button>
                </div>
            </div>
        </div>`;
    }).join("");
}

function getBookingById(id) {
    return bookings.find(b => String(b.id) === String(id));
}

function bookingDetailHTML(b, title) {
    return `
        <div class="modal-header">
            <div><p class="kicker">${title}</p><h2>${esc(b.id)}</h2></div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div style="line-height:1.8;">
            <p><strong>Phòng:</strong> ${esc(b.room)}</p>
            <p><strong>Số phòng:</strong> ${esc(b.roomNumber)}</p>
            <p><strong>Loại phòng:</strong> ${esc(b.roomType)}</p>
            <hr style="margin:15px 0;border:0;border-top:1px solid #eee;">
            <p><strong>Họ tên:</strong> ${esc(b.customerName)}</p>
            <p><strong>Điện thoại:</strong> ${esc(b.customerPhone)}</p>
            <p><strong>Email:</strong> ${esc(b.customerEmail)}</p>
            <hr style="margin:15px 0;border:0;border-top:1px solid #eee;">
            <p><strong>Ngày nhận:</strong> ${esc(b.checkin)}</p>
            <p><strong>Ngày trả:</strong> ${esc(b.checkout)}</p>
            <p><strong>Số đêm:</strong> ${esc(b.nights)}</p>
            <p><strong>Tổng tiền:</strong>
               <span style="color:#b99455;font-weight:700;">${money(b.total)}</span></p>
            ${b.note ? `<p><strong>Ghi chú:</strong> ${esc(b.note)}</p>` : ""}
            <p><strong>Trạng thái:</strong> ${esc(b.status)}</p>
            <p><strong>Ngày tạo:</strong> ${esc(b.createdAt || "")}</p>
        </div>
        <div class="modal-footer">
            <button class="btn outline" onclick="closeModal()">Đóng</button>
        </div>`;
}

function viewBooking(id) {
    const b = getBookingById(id);
    if (!b) return toast("Không tìm thấy đơn đặt phòng.");
    if (!isAdmin() && (!currentUser || !sameEmail(b.customerEmail, currentUser.email))) {
        return toast("Bạn không có quyền xem đơn này.");
    }
    openModal(bookingDetailHTML(b, "CHI TIẾT ĐẶT PHÒNG"));
}

function cancelBooking(id) {
    const b = getBookingById(id);
    if (!b) return toast("Không tìm thấy đơn đặt phòng.");
    if (!currentUser) { toast("Vui lòng đăng nhập."); return openLogin(); }
    if (!sameEmail(b.customerEmail, currentUser.email)) return toast("Bạn không có quyền hủy đơn này.");
    if (b.status !== "Đã xác nhận") return toast("Đơn này không thể hủy.");
    if (!confirm("Bạn có chắc chắn muốn hủy đơn đặt phòng này?")) return;

    b.status = "Đã hủy";
    syncRoomStatus();
    saveData();
    renderAll();
    closeModal();
    toast("Đã hủy đặt phòng thành công.");
}

/* =========================
   ADMIN
   ========================= */

function updateAdminVisibility() {
    const section = document.getElementById("admin");
    if (section) section.style.display = isAdmin() ? "" : "none";
}

function renderAdmin() {
    if (!isAdmin()) return;

    const confirmed = bookings.filter(b => b.status === "Đã xác nhận");
    const revenue = confirmed.reduce((s, b) => s + Number(b.total || 0), 0);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("sRooms", rooms.length);
    set("sAvailable", rooms.filter(r => r.status === "Trống").length);
    set("sBookings", confirmed.length);
    set("sRevenue", money(revenue));

    const tbody = document.getElementById("adminTable");
    if (!tbody) return;

    tbody.innerHTML = rooms.map(r => `
        <tr>
            <td><strong>${esc(r.name)}</strong><br><small>Phòng ${r.id}</small></td>
            <td>${esc(r.type)}</td>
            <td>${r.capacity} khách</td>
            <td>${money(r.price)}</td>
            <td>${esc(r.status)}</td>
            <td>
                <button class="btn outline" style="padding:6px 10px;"
                        onclick="toggleMaintenance(${r.id})">
                    ${r.status === "Bảo trì" ? "Mở lại" : "Bảo trì"}
                </button>
                <button class="btn dark" style="padding:6px 10px;"
                        onclick="deleteRoom(${r.id})">Xóa</button>
            </td>
        </tr>`).join("");
}

function toggleMaintenance(id) {
    const room = rooms.find(r => r.id === id);
    if (!room) return;

    if (room.status === "Bảo trì") {
        room.status = "Trống";
        saveData();
        syncRoomStatus();
        saveData();
        toast("Đã mở lại phòng.");
    } else {
        room.status = "Bảo trì";
        saveData();
        toast("Đã chuyển phòng sang bảo trì.");
    }
    renderAll();
}

function deleteRoom(id) {
    const hasActive = bookings.some(b => Number(b.roomId) === id && b.status === "Đã xác nhận");
    if (hasActive) return toast("Phòng đang có đơn đặt, không thể xóa.");
    if (!confirm("Bạn có chắc muốn xóa phòng này?")) return;

    rooms = rooms.filter(r => r.id !== id);
    saveData();
    renderAll();
    toast("Đã xóa phòng.");
}

function openAddRoom() {
    if (!isAdmin()) return toast("Chỉ quản trị viên mới thực hiện được.");
    openModal(`
        <div class="modal-header">
            <div><p class="kicker">QUẢN TRỊ</p><h2>Thêm phòng mới</h2></div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form onsubmit="addRoom(event)">
            <div class="form-group"><label>Tên phòng</label>
                <input id="newName" type="text" required placeholder="Deluxe Garden"></div>
            <div class="form-group"><label>Hạng phòng</label>
                <select id="newType">
                    <option>Standard</option><option>Deluxe</option><option>Family</option>
                </select></div>
            <div class="form-group"><label>Sức chứa</label>
                <input id="newCapacity" type="number" min="1" max="10" value="2" required></div>
            <div class="form-group"><label>Giá / đêm (VNĐ)</label>
                <input id="newPrice" type="number" min="0" step="10000" value="800000" required></div>
            <div class="form-group"><label>Link ảnh (không bắt buộc)</label>
                <input id="newImage" type="url" placeholder="https://..."></div>
            <div class="modal-footer">
                <button type="button" class="btn outline" onclick="closeModal()">Hủy</button>
                <button type="submit" class="btn gold">Thêm phòng</button>
            </div>
        </form>
    `);
}

function addRoom(event) {
    event.preventDefault();
    const name = document.getElementById("newName").value.trim();
    const type = document.getElementById("newType").value;
    const capacity = Number(document.getElementById("newCapacity").value);
    const price = Number(document.getElementById("newPrice").value);
    const image = document.getElementById("newImage").value.trim() || seedRooms[0].image;

    if (!name || capacity < 1 || price < 0) return toast("Dữ liệu phòng không hợp lệ.");

    const newId = rooms.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    rooms.push({ id: newId, name, type, capacity, price, status: "Trống", image });
    saveData();
    renderAll();
    closeModal();
    toast("Đã thêm phòng mới.");
}

/* =========================
   ĐỒNG BỘ TRẠNG THÁI PHÒNG
   ========================= */

function syncRoomStatus() {
    rooms.forEach(room => {
        if (room.status === "Bảo trì") return;
        const booked = bookings.some(b =>
            Number(b.roomId) === Number(room.id) && b.status === "Đã xác nhận");
        room.status = booked ? "Đã đặt" : "Trống";
    });
    localStorage.setItem("haven_rooms", JSON.stringify(rooms));
}

function renderAll() {
    renderRooms();
    renderBookings();
    renderAdmin();
}

/* =========================
   HIỆU ỨNG: RIPPLE, BACK TO TOP
   ========================= */

document.addEventListener("click", e => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.left = (e.clientX - rect.left) + "px";
    ripple.style.top = (e.clientY - rect.top) + "px";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

window.addEventListener("scroll", () => {
    const top = document.getElementById("topBtn");
    if (top) top.classList.toggle("show", window.scrollY > 400);
});

/* =========================
   PHÍM TẮT, ENTER
   ========================= */

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        closeModal();
        closeAuthModal();
    }
    if (e.key === "Enter") {
        const auth = document.getElementById("authModal");
        if (auth && !auth.classList.contains("hidden") && auth.style.display !== "none") {
            const loginVisible = document.getElementById("loginForm")?.style.display !== "none";
            if (e.target.tagName === "INPUT") {
                e.preventDefault();
                loginVisible ? login() : register();
            }
        }
    }
});

["searchIn", "searchOut", "searchGuests"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); searchRooms(); }
    });
});

document.getElementById("authModal")?.addEventListener("click", e => {
    if (e.target.id === "authModal") closeAuthModal();
});

/* =========================
   KHỞI TẠO
   ========================= */

function initializeWebsite() {
    syncRoomStatus();
    updateLoginButton();
    updateAdminVisibility();
    renderAll();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeWebsite);
} else {
    initializeWebsite();
}

/* Tắt màn hình loading */
function hideLoader() {
    document.getElementById("pageLoader")?.classList.add("hide");
}
window.addEventListener("load", hideLoader);
setTimeout(hideLoader, 3000); /* dự phòng nếu load bị chậm */