# Cà phê Đạm — Web quản lý ca

Web app/PWA nội bộ, xây bằng React DOM + Vite và tối ưu cho nhân viên thao tác trên điện thoại. Người dùng mở bằng đường dẫn HTTPS hoặc thêm ứng dụng vào màn hình chính, không cần cài ứng dụng native.

## Chức năng chính

- Ba vai trò: chủ cửa hàng, quản lý chi nhánh và nhân viên.
- Đăng nhập, tạo tài khoản nhân viên và quản lý phiên bằng Supabase Auth.
- Form đăng nhập mobile-first, vùng chạm lớn, hỗ trợ autofill và trình quản lý mật khẩu của trình duyệt.
- Đổi mật khẩu sau khi xác thực lại mật khẩu hiện tại. Mật khẩu không được lưu dạng đọc được trong localStorage hay cơ sở dữ liệu ứng dụng.
- Chấm công, tính lương, xác nhận bảng lương theo cấp nhân viên → quản lý → chủ cửa hàng.
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

Tài khoản tạo trong web mặc định là `employee`. Sau khi tạo tài khoản, dùng các câu lệnh mẫu cuối file SQL để cấp quyền `manager` hoặc `owner`. Khi đã tạo đủ tài khoản nhân sự, nên tắt public signup trong Supabase.

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

## Kiểm tra và build

```bash
npm run typecheck
npm run build
npm run preview
```

Build production nằm trong `dist`. Vercel dùng `npm run build` và tự phục vụ fallback về `index.html` cho web app.

Các tài nguyên PWA trong `public` được Vite sao chép sang `dist`: `manifest.json`, icon 192/512 và `sw.js`.
