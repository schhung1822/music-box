# Khoảng lặng · Chill Music Recorder

Giao diện nghe nhạc tối giản bằng tiếng Việt, chạy trên cấu trúc Next.js 16, React 19, TypeScript và Tailwind CSS 4 có sẵn. Không có máy chủ xử lý dữ liệu, đăng nhập hoặc lưu trữ. Thư viện ngoài duy nhất là `ogl` và `three`, chỉ dùng cho các nền động tùy chọn và chỉ tải khi bạn chọn một nền.

## Chạy dự án

```sh
npm install
npm run dev
```

Mở địa chỉ máy chủ in ra, thường là http://localhost:3000. Nếu dự án đang chạy, tiếp tục dùng máy chủ đó.

```sh
npm run lint
npx tsc --noEmit
npm run build
npm start
```

## Giao diện hiện tại

- Nền gần đen, không bảng điều khiển, thẻ nội dung hoặc thanh bên cố định.
- Từ 768px: khung ảnh vuông, tên bài hát, nghệ sĩ và điều khiển ở trái; lời bài hát lớn ở phải.
- Dưới 768px: ảnh, thông tin và điều khiển, rồi lời bài hát. Vùng lời giới hạn chiều cao để chỉ thấy vài câu quanh câu hiện tại.
- Câu hiện tại màu trắng, đậm; các câu xa hơn có độ mờ tăng dần. Chọn một câu để xem thử chuyển trạng thái và cuộn về giữa vùng lời.
- Cuộn chỉ tác động vùng lời, không kéo cả trang. ResizeObserver căn lại câu khi đổi kích thước, ngắt dòng hoặc tải phông chữ. Tôn trọng tùy chọn giảm chuyển động.
- Toàn bộ nhãn, hướng dẫn, lỗi, mô tả truy cập, metadata và trang 404 bằng tiếng Việt. Tên định dạng tệp và thương hiệu YouTube được giữ nguyên.

## Thiết lập

Nút **Thiết lập** mở hộp thoại native có khóa tiêu điểm và hỗ trợ đóng bằng Esc hoặc nhấn ngoài hộp thoại. Các thiết lập không chiếm chỗ trong bố cục chính; đóng hộp thoại hoặc đổi mục không xóa nội dung đã nhập.

Ba mục:

1. **Nguồn phát**: chọn video/âm thanh/ảnh bìa, chọn nguồn YouTube, nhập tên bài hát và nghệ sĩ.
2. **Lời bài hát**: dán và áp dụng lời lên giao diện, chọn tệp LRC, chọn câu đang hiển thị để xem thử.
3. **Hiển thị**: chọn kiểu khung hình, chọn nền trang, bật/tắt lời và tiến trình trong chế độ ghi hình, chọn tỉ lệ bản ghi.

Tệp hiện chỉ được chọn trong bộ nhớ, chưa đọc hoặc phát. Tệp LRC chưa được phân tích. Chữ mẫu được viết riêng cho ứng dụng, không trích lời bài hát có sẵn. Thay lời sẽ chuyển nhãn từ lời minh họa sang lời của bạn.

## Nền trang

Mục **Hiển thị** có bốn lựa chọn nền:

- **Mặc định** — nền tối sẵn có với hai vệt sáng rất nhạt, thuần CSS.
- **Kim loại nóng chảy**, **Sóng gradient**, **Ether lỏng** — ba nền WebGL lấy từ [React Bits](https://reactbits.dev), đã chỉnh bảng màu theo tông xanh rêu của giao diện.

Ba nền động chỉ là lớp trang trí sau nội dung:

- Chỉ tải mã khi được chọn, nên nền mặc định không phải trả phí cho `ogl` hay `three`.
- Đặt `pointer-events: none` nên không chắn thao tác nào.
- Tự tắt khi hệ điều hành bật giảm chuyển động, khi trình duyệt không dựng được WebGL 2, và trong lúc ghi hình để nhường GPU cho canvas.
- **Không đi vào bản ghi.** Video xuất ra luôn dùng nền tối mặc định, vì bản ghi được vẽ riêng trên canvas 2D trong `utils/renderScene.ts`.

Muốn đổi tông màu nền thì sửa hằng số `palettes` trong `components/StudioBackground.tsx`.

## Chế độ ghi hình

Nút **Chế độ ghi hình** ở đầu trang hoặc **Bật chế độ ghi hình** trong thiết lập:

- Đóng hộp thoại; ẩn thương hiệu, nút thiết lập, nút chuyển chế độ, điều khiển phát và chú thích.
- Vùng ghi hình chỉ có ảnh minh họa, tên bài hát, nghệ sĩ, lời và thanh tiến trình tùy chọn.
- Tiến trình trở thành phần hiển thị thụ động, không phải trường nhập. Lời không còn là nút bấm.
- Có thể ẩn hoàn toàn lời hoặc tiến trình bằng hai công tắc trong thiết lập.
- **Nhấn Esc hoặc nhấp/chạm hai lần vào khung hình để thoát.** Bàn phím còn có nút thoát chỉ xuất hiện khi được focus; lúc đó focus sẽ được khôi phục về nút chuyển chế độ.
- Chỉ báo nhà phát triển của Next.js được tắt để không lọt vào khung quay.

Chế độ này chỉ làm sạch giao diện để người dùng tự quay màn hình. Không gọi API ghi màn hình, không tạo bản ghi và không xuất tệp video.

## Cấu trúc

```text
app/
  page.tsx                 Điểm vào không gian nghe nhạc
  layout.tsx               Ngôn ngữ vi, metadata, phông hỗ trợ tiếng Việt
  globals.css              Giao diện tối, bố cục, hiệu ứng, hộp thoại
  not-found.tsx            Trang 404 tiếng Việt
components/
  AppHeader.tsx            Hai nút mở thiết lập và chế độ ghi hình
  Studio.tsx               Trạng thái chung, hộp thoại, vào/thoát chế độ
  MusicPlayer.tsx          Khung ảnh, thông tin, tiến trình và điều khiển
  LyricsPanel.tsx          Hiển thị, làm mờ và cuộn lời
  LyricsEditor.tsx         Nhập lời, chọn LRC và câu xem thử
  MediaSetup.tsx           Chọn tệp, nguồn phát, tên bài và nghệ sĩ
  OutputSettings.tsx       Tùy chọn hiển thị, nền trang và xuất video sau này
  StudioBackground.tsx     Chọn và gắn lớp nền động, có chốt an toàn khi WebGL hỏng
  backgrounds/             Nguồn nguyên bản của React Bits (ogl, three)
  Icon.tsx                 Biểu tượng giao diện
hooks/
  useBackdropGate.ts       Đo giảm chuyển động và khả năng dựng WebGL 2
next.config.ts             Tắt chỉ báo phát triển trên màn hình
```

## Kiểm tra

- Build production, TypeScript và ESLint.
- HTTP trang chính và trang 404.
- Render các thành phần React để kiểm tra khung ghi hình không có button/input/textarea/select, giữ đúng nội dung, và có thể ẩn tiến trình.
- Đối chiếu CSS ở 320, 390, 767, 768, 1024 và 1440px: một cột dưới 768px, hai cột từ 768px.

**Chưa xác nhận bằng trình duyệt trực quan:** kết nối trình duyệt trong phiên làm việc không có trình duyệt khả dụng. Các kiểm tra CSS và HTML không thay thế kiểm thử tương tác trên thiết bị thật.

Danh sách kiểm tra thủ công:

1. Đổi kích thước máy tính/điện thoại, kiểm tra khung vuông, xuống dòng và không cuộn ngang.
2. Mở/đóng thiết lập bằng nút, Esc và nhấn ngoài; nhập dữ liệu rồi mở lại.
3. Áp dụng lời, chọn câu đầu/giữa/cuối, thử lời dài và đổi kích thước; câu hiện tại vẫn nằm giữa vùng lời.
4. Bật chế độ ghi hình từ cả hai nút. Xác nhận không còn nút thiết lập, trường nhập, điều khiển hay chỉ báo Next.js.
5. Thử bật/tắt lời và tiến trình, thoát bằng Esc, chạm hai lần, và bàn phím.
6. Kiểm tra giảm chuyển động và tải lại trang để xác nhận trạng thái được xóa.

## Công việc tiếp theo

Đây vẫn là bước cải tiến giao diện của giai đoạn 1, có thêm xem thử lời bằng thao tác thủ công. Phát nhạc thực chưa được triển khai: điều khiển phát, tua và âm lượng vẫn bị vô hiệu hóa.

Giai đoạn 2: object URL và thu hồi URL, audio/video HTML5, ưu tiên video → ảnh bìa → ảnh mặc định, phát/tạm dừng, tua, âm lượng, xử lý lỗi và đồng bộ audio/video đơn giản.

Các bước sau: đọc LRC và bám thời gian phát, đồng bộ lời thủ công, vẽ Canvas, MediaRecorder và tải WebM, cuối cùng là phát nhúng YouTube tách biệt với việc xuất tệp cục bộ.
