# Cà phê Đạm — Web quản lý ca

Web app/PWA nội bộ, xây bằng React DOM + Vite và tối ưu cho nhân viên thao tác trên điện thoại. Người dùng mở bằng đường dẫn HTTPS hoặc thêm ứng dụng vào màn hình chính, không cần cài ứng dụng native.

## Chức năng chính

- Ba vai trò: chủ cửa hàng, quản lý chi nhánh và nhân viên.
- Đăng nhập, tạo tài khoản nhân viên và quản lý phiên bằng Supabase Auth.
- Form đăng nhập mobile-first, vùng chạm lớn, hỗ trợ autofill và trình quản lý mật khẩu của trình duyệt.
- Đổi mật khẩu sau khi xác thực lại mật khẩu hiện tại. Mật khẩu không được lưu dạng đọc được trong localStorage hay cơ sở dữ liệu ứng dụng.
- Hồ sơ tài khoản với avatar, số điện thoại, vị trí, chi nhánh, hình thức làm việc và thâm niên.
- Nhân viên tự sửa tên, số điện thoại, ảnh đại diện; Chủ cửa hàng quản lý vai trò, chi nhánh, Full/Part time và ngày bắt đầu của nhân sự.
- Xếp lịch theo thẻ tên gọn, chọn giờ về ca sáng 9h/10h/11h/đủ ca, tự điền bảng công khi gửi lịch và tải ảnh lịch dạng bảng.
- Chấm công, tính lương và duyệt lương theo từng nhân viên; quản lí có thể xem/sửa các tháng trước trước khi gửi tổng hợp cho chủ cửa hàng.
- Ca chiều Chủ Nhật luôn bị khóa; giờ mặc định từ lịch là 6 giờ sáng, 5 giờ chiều và 0,5 giờ mở cửa.
- Báo đồ, báo ca, tổng hợp theo chi nhánh và xuất báo cáo thành ảnh.
- Dữ liệu vận hành đồng bộ với Supabase Postgres; phiên đăng nhập được duy trì bằng localStorage.
- Manifest và service worker để cài như PWA sau khi triển khai HTTPS.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+.
- Một project Supabase đã cấu hình Email Auth.

## Cấu hình Supabase

1. Bật Email provider trong Authentication → Providers. Với ứng dụng nội bộ không gửi email xác nhận, tắt `Confirm email`.
2. Chạy [database/supabase-schema.sql](database/supabase-schema.sql) trong SQL Editor để tạo bảng, dữ liệu chi nhánh và chính sách RLS.
3. Sao chép `.env.example` thành `.env` và điền hai biến:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Các API quản lí nhân sự và tạo dữ liệu thử nghiệm cần thêm `SUPABASE_SECRET_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`) ở biến môi trường **server** của Vercel/.env.local. Không đặt khóa này ở biến `VITE_*` hay đưa lên trình duyệt.

Tài khoản tạo trong web mặc định là `employee`. Sau khi tạo tài khoản, dùng các câu lệnh mẫu cuối file SQL để cấp quyền `manager` hoặc `owner`. Khi đã tạo đủ tài khoản nhân sự, nên tắt public signup trong Supabase.

Khi cập nhật từ phiên bản cũ, chạy lại toàn bộ `database/supabase-schema.sql`. Script có thể chạy lặp lại và sẽ bổ sung các cột hồ sơ, hàm cập nhật an toàn cùng bucket `avatars` mà không xóa dữ liệu vận hành hiện có.

## Chạy local

```bash
npm install
npm run web
```

Mở `http://127.0.0.1:5173` trên máy tính.

Để thử trên điện thoại cùng mạng Wi-Fi:

```bash
npm run web:lan
```

Sau đó mở địa chỉ LAN Vite hiển thị, ví dụ `http://192.168.1.10:5173`. Không dùng `localhost` trên điện thoại vì địa chỉ đó trỏ về chính điện thoại.

Để thử cả các route `/api/*` tại máy local (quản lí nhân sự, đổi tên xếp lịch và tạo dữ liệu mẫu), chạy:

```bash
npm run dev:vercel
```

Lệnh này cần `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và `SUPABASE_SECRET_KEY` trong môi trường local.

## Dữ liệu thử nghiệm

Sau khi chạy lại `database/supabase-schema.sql`, đăng nhập bằng tài khoản Chủ cửa hàng, mở tab **Nhân sự** và chọn **Tạo dữ liệu thử nghiệm**. Hệ thống tạo một quản lí và ba nhân viên cho mỗi chi nhánh; bảng công tháng hiện tại được đánh dấu đã gửi để quản lí duyệt. Mật khẩu của các tài khoản demo được hiển thị trong màn hình đó và được đặt lại mỗi lần tạo lại dữ liệu.

## Kiểm tra và build

```bash
npm run typecheck
npm run build
npm run preview
```

Build production nằm trong `dist`. Vercel dùng `npm run build` và tự phục vụ fallback về `index.html` cho web app.

Các tài nguyên PWA trong `public` được Vite sao chép sang `dist`: `manifest.json`, icon 192/512 và `sw.js`.

## Cài lên màn hình chính

Sau khi triển khai bằng HTTPS, ứng dụng mở ở chế độ `standalone` và không còn thanh địa chỉ khi khởi chạy từ biểu tượng:

- Android/Chrome: chọn **Cài ứng dụng** trên thẻ hướng dẫn trong màn hình đăng nhập, hoặc mở menu trình duyệt → **Cài đặt ứng dụng**.
- iPhone/iPad: mở bằng Safari, nhấn **Chia sẻ** → **Thêm vào MH chính**.

Giao diện khóa theo chiều rộng thiết bị và chỉ cuộn dọc. Các vùng an toàn của màn hình tai thỏ/thanh home, bàn phím ảo và viewport động trên mobile đã được tính trong layout.
