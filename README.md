# Cà phê Đạm - Web quản lý ca

Ứng dụng web/PWA nội bộ cho quán cà phê. Nhân viên mở bằng link hoặc quét QR trên điện thoại, không cần cài app riêng từ App Store hay Google Play.

## Chức năng

- Có 3 vai trò: Chủ cửa hàng, Quản lí chi nhánh và Nhân viên.
- Đăng nhập bằng Supabase Auth qua email + mật khẩu, hồ sơ người dùng lưu email, role và chi nhánh trong bảng `profiles`.
- Giao diện đăng nhập mobile-first dành cho nhân viên dùng điện thoại, hỗ trợ autofill, bàn phím theo luồng và vùng chạm lớn.
- Người dùng đã đăng nhập có thể tự đổi mật khẩu sau khi xác thực lại mật khẩu hiện tại; ứng dụng không lưu mật khẩu dạng đọc được trên thiết bị.
- Chấm công theo bảng công tháng, nhập giờ ca sáng/ca chiều, tính lương theo giờ, tiền ăn sáng và phụ cấp.
- Nhân viên xác nhận bảng lương trước khi quản lí chi nhánh nhìn thấy.
- Quản lí chi nhánh xem bảng tổng hợp nhân viên đã xác nhận, xác nhận gửi chủ cửa hàng, hủy xác nhận trước ngày cuối tháng và có tự xác nhận trước ngày cuối tháng một ngày.
- Chủ cửa hàng chọn chi nhánh và tháng/năm để xem bảng lương đã được quản lí xác nhận.
- Chủ cửa hàng xem báo đồ theo từng chi nhánh.
- Báo đồ theo danh sách món cố định, gồm món báo số lượng kèm trạng thái hết và món chỉ báo trạng thái còn/hết.
- Báo ca theo form thực tế gồm ly nhựa tự tính số bán, sữa bắp tự tính đủ/thiếu/dư, bình nhỏ/lớn, cà phê gói nhỏ/lớn, tiền, đá, bình nước, tiền nạp card và ghi chú.
- Lưu dữ liệu cục bộ trên thiết bị bằng AsyncStorage.
- Đồng bộ dữ liệu vận hành lên Supabase Postgres: bảng công, xác nhận lương chi nhánh, báo đồ và báo ca.
- Có manifest PWA, icon 192/512 và service worker network-first để có thể thêm biểu tượng ra màn hình chính sau khi deploy HTTPS.

## Cấu hình Supabase

1. Tạo project Supabase.
2. Vào Authentication > Providers > Email, bật Email provider.
   Với app nội bộ không muốn gửi email xác nhận, tắt `Confirm email`.
   Nếu bật `Confirm email`, Supabase vẫn sẽ gửi email xác nhận khi tạo tài khoản mới.
3. Mở SQL Editor và chạy nội dung trong `database/supabase-schema.sql`.
   Script tạo các bảng chi nhánh, hồ sơ tài khoản, bảng công, xác nhận lương, báo đồ và báo ca, kèm RLS theo vai trò.
   Nếu project cũ đã dùng cột `phone`, script này cũng sẽ đổi sang `email`.
4. Tạo file `.env` từ `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

5. Khởi động lại Expo sau khi đổi `.env`.

Email nên nhập theo định dạng `ten@congty.com`.

Lưu ý vận hành: tài khoản tạo từ app luôn là `employee`. Sau khi tạo tài khoản, dùng hai lệnh mẫu ở cuối file SQL để nâng quyền cho chủ quán hoặc quản lí. Cách này tránh người ngoài tự tạo quyền cao. Khi đã tạo đủ tài khoản nhân sự, hãy tắt public signup trong Supabase.

## Chạy thử

```bash
npm install
npm run web
```

Trên chính máy tính đang chạy dự án, mở `http://localhost:8081`.

Nếu muốn mở từ điện thoại cùng mạng Wi-Fi, chạy:

```bash
npm run web:lan
```

Sau đó mở địa chỉ LAN mà Expo hiển thị trong terminal, ví dụ `http://192.168.1.10:8081`. Không dùng `localhost` trên điện thoại vì địa chỉ đó trỏ về chính điện thoại, không phải máy tính đang chạy Expo.

## Build web/PWA

```bash
npm run build:web
```

Lệnh này xuất bản web tĩnh vào thư mục `dist`. Deploy toàn bộ thư mục `dist` lên Vercel, Netlify, Cloudflare Pages hoặc hosting tĩnh có HTTPS.

Các file PWA nằm trong `public` và được copy sang `dist` khi build:

- `manifest.json`
- `pwa-192.png`
- `pwa-512.png`
- `sw.js`

Sau khi deploy, nhân viên mở link trên Chrome/Safari rồi chọn thêm vào màn hình chính nếu cần dùng như app.

## Chạy native nếu cần kiểm thử cũ

Ứng dụng vẫn là Expo React Native nên vẫn có thể chạy thử native, nhưng đây không còn là hướng triển khai chính:

- `npm run android`
- `npm run ios`

## Kiểm tra TypeScript

```bash
npm run typecheck
```
