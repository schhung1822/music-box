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

## Bản Windows (Electron)

Cùng giao diện và mã với bản web, nhưng chạy trong cửa sổ riêng nên không bị trình duyệt giảm tốc:

- Hoạt ảnh lời, nền WebGL và bộ vẽ bản ghi không bị giảm nhịp khi cửa sổ mất tiêu điểm hoặc bị cửa sổ khác che.
- **Ghi nền:** đang ghi mà bấm thu nhỏ thì cửa sổ ẩn xuống khay hệ thống (biểu tượng có chấm đỏ) và vẫn ghi đủ 60 khung. Nhấp biểu tượng để mở lại, hoặc chuột phải → *Dừng ghi*. Hết bản ghi cửa sổ tự hiện lại. (Thu nhỏ hẳn theo kiểu Windows làm hệ điều hành ngừng dựng hình, chỉ còn khoảng 1 khung/giây, nên bản desktop chuyển nó thành "ẩn xuống khay".)
- **Nền động đi vào video:** nền WebGL đang chạy được chép vào từng khung của bản ghi (công tắc *Đưa nền động vào video* ở mục Hiển thị; dùng được cả ở bản web). Tắt công tắc nếu muốn nền tối tĩnh như trước.
- Bản ghi MP4 dùng bộ mã hóa H.264 phần cứng của máy khi có.

```sh
npm run desktop        # dựng bản xuất tĩnh vào desktop-web/ rồi mở cửa sổ Electron
npm run desktop:start  # mở lại mà không dựng lại
npm run desktop:dist   # đóng gói vào release/: bộ cài NSIS và bản portable (.exe)
```

Ghi chú:

- Dự án dùng Electron 41 vì các bản mới hơn đòi Node 22, trong khi máy hiện dùng Node 20.
- `desktop:dist` tự tạo biểu tượng (`desktop/make-icon.cjs`). Việc chỉnh biểu tượng cho tệp .exe được làm bằng `rcedit` (`desktop/after-pack.cjs`) vì gói winCodeSign của electron-builder không giải nén được khi Windows chưa bật Developer Mode.
- Bộ cài chưa được ký số nên SmartScreen có thể cảnh báo ở lần chạy đầu.
- Biến môi trường `ELECTRON_RUN_AS_NODE` (VS Code đặt sẵn trong một số terminal) làm `electron.exe` chạy như Node thường; `desktop/start.cjs` đã bỏ biến này.
- Mã nằm trong `desktop/`: `main.cjs` (cửa sổ, khay, cờ Chromium), `preload.cjs` (cầu nối hẹp), `static-server.cjs` (phục vụ bản xuất tĩnh trên 127.0.0.1).

## Giao diện hiện tại

- Nền gần đen, không bảng điều khiển, thẻ nội dung hoặc thanh bên cố định.
- Từ 768px: khung ảnh vuông, tên bài hát, nghệ sĩ và điều khiển ở trái; lời bài hát lớn ở phải.
- Dưới 768px: ảnh, thông tin và điều khiển, rồi lời bài hát. Vùng lời giới hạn chiều cao để chỉ thấy vài câu quanh câu hiện tại.
- Câu hiện tại màu trắng, đậm; các câu xa hơn có độ mờ tăng dần. Chọn một câu để xem thử chuyển trạng thái và cuộn về giữa vùng lời.
- Cuộn chỉ tác động vùng lời, không kéo cả trang. ResizeObserver căn lại câu khi đổi kích thước, ngắt dòng hoặc tải phông chữ. Tôn trọng tùy chọn giảm chuyển động.
- Chuyển câu lời dùng lò xo giảm chấn tới hạn (`utils/lyricSpring.ts`) như giao diện thẻ nhạc: vùng lời cuộn bằng lò xo, bản ghi khung ngang trượt theo cùng công thức, bản ghi khung dọc (một câu chữ lớn) mờ chéo bằng đường cong êm cùng họ. Câu trước càng cao thì trượt càng chậm; đổi câu giữa chừng thì giữ vận tốc.
- Toàn bộ nhãn, hướng dẫn, lỗi, mô tả truy cập, metadata và trang 404 bằng tiếng Việt. Tên định dạng tệp và thương hiệu YouTube được giữ nguyên.

## Giao diện thẻ nhạc (`/card`)

Một giao diện thứ hai nằm ở trang riêng http://localhost:3000/card (bản Windows: cùng đường dẫn `/card`), dùng chung bộ phát, lời, thiết lập và bộ ghi hình với trang gốc. Có thể đổi qua lại ở *Thiết lập → Hiển thị → Giao diện*; mỗi trang là một lần tải riêng nên các tệp đã chọn phải chọn lại.

- Nền trang là ảnh trong `public/background/` (mặc định `bg1.jpg`), làm mờ nhẹ và phủ lớp tối. Đổi ảnh nền, ảnh mặc định của khung vuông (`thumbanail.jpg`), độ mờ và độ tối ở đầu/cuối `utils/cardLayout.ts` (độ mờ và độ tối của thẻ ở `app/globals.css`, mục `.card-backdrop` và `.card-player`).
- Thẻ kính mờ kiểu bộ điều khiển nhạc của iOS: khung vuông video/ảnh bìa (chưa chọn gì thì hiện ảnh thumbnail mặc định), tên bài và nghệ sĩ, thanh thời gian (còn lại kiểu `-4:52`), rồi một hàng nút giống giao diện mặc định: thiết lập ở trái, lùi 10 giây / phát / tiến 10 giây ở giữa, tắt/bật âm thanh ở phải.
- Lời hát chạy từ dưới lên và chỉ hiện câu đang hát cùng câu kế tiếp; câu cũ trôi lên rồi tan đi. Câu dài hơn ba dòng tự thu nhỏ chữ để hiện trọn (`utils/lyricFit.ts`, giao diện và bản ghi dùng chung). Ba hiệu ứng chuyển lời vẫn dùng được.
- Chuyển câu chạy bằng lò xo giảm chấn tới hạn thay cho đường cong cố định (`utils/lyricSpring.ts`, giao diện và bản ghi dùng chung; độ sáng và độ phóng từng câu ở `utils/cardMotion.ts`): bắt đầu êm, đổi câu giữa chừng thì giữ nguyên vận tốc, câu trước càng cao thì trượt càng chậm (tối đa 1,5 lần), và đúng theo thời gian thật nên khung hình bị trễ chỉ làm bước nhảy lớn hơn chứ không làm chuyển động khựng. Trên giao diện cột lời trượt bằng `transform`, không dùng `scrollTop`.
- Bản ghi vẽ một lần lớp tĩnh (ảnh nền mờ, kính, bóng đổ, tên bài, tên nguồn) vào canvas phụ rồi chép lại mỗi khung; riêng bóng đổ làm mờ đã tốn cỡ 18 ms mỗi khung khi không có GPU. Mỗi khung chỉ vẽ lại video, thanh tiến trình và lời hát.
- **Bản ghi không có nút điều khiển** cho gọn: chỉ còn ảnh, tên bài, thanh thời gian và lời. Giao diện này **chỉ ghi khung dọc 9:16, cố định 1080×1920** (không tăng độ phân giải theo video nguồn) với tốc độ bit khoảng 8 Mbps, nên tệp nhẹ (khoảng 60 MB mỗi phút); chỉnh ở `cardVideoBitsPerSecond` trong `utils/recordingQuality.ts`. Thẻ phóng gần kín bề ngang (khoảng 88%) và nằm giữa khung, giống giao diện khi mở trên điện thoại. Chừa mép trên/dưới/hai bên ở `safe` trong `utils/cardLayout.ts` (tăng `bottom` nếu muốn đẩy lời lên cao, tránh phần mô tả của TikTok ở đáy).
- Cuối thẻ có dòng tên nguồn **@Hunq.lofi** kiểu sans đậm nghiêng (Geist 700 nghiêng), có cả trong bản ghi. Đổi tên ở `cardCredit` trong `utils/cardLayout.ts`.
- Hộp thiết lập của trang này dùng bảng màu xám kính và trắng (khối `.card-dialog` cuối `app/globals.css`) thay cho xanh rêu của trang gốc.
- Mã: `components/CardPlayer.tsx` (giao diện), `utils/renderCard.ts` (bản vẽ canvas của bản ghi), `utils/cardLayout.ts` (số đo dùng chung cho cả hai, để chữ xuống dòng giống hệt nhau). Sửa kích thước thẻ thì chỉ sửa `cardLayout.ts`.

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

## Vị trí video và hiệu ứng chuyển lời

- **Dời video:** rê chuột lên khung video để hiện thanh vị trí ở đầu khung (← ↑ ↓ → và nút canh giữa; giữ nút để dời liên tục), hoặc kéo thẳng trên video bằng chuột hay ngón tay. Độ dời được giới hạn để mép video không trôi hẳn khỏi khung, và bản ghi giữ đúng vị trí đang thấy. Video vuông ở mức lấp đầy không có chỗ để dời; phóng to hoặc dùng video ngang/dọc để dời được. Chọn video mới thì vị trí về giữa.
- **Hiệu ứng chuyển lời** (mục Hiển thị, áp dụng cho giao diện và bản ghi, cả khung 4:3 lẫn 9:16):
  - *Trượt cuộn* — hiệu ứng sẵn có.
  - *Tô chữ theo nhịp* — câu đang hát mờ, ánh sáng chạy từ trái sang phải qua từng chữ như karaoke, xong trước khi câu kế tiếp bắt đầu. Cần lời có mốc thời gian; lời chưa có mốc hiện sáng cả câu. Vệt tô dùng đồng hồ nội suy để chạy đều chứ không giật theo nhịp cập nhật của media.
  - *Hiện từng chữ* — mỗi chữ trồi lên và rõ dần từ trạng thái nhòe, chữ sau trễ hơn chữ trước (câu dài thì các chữ sát nhau hơn để cả câu hiện xong trong khoảng một giây).
  - Các hằng số thời gian nằm trong `utils/lyricMotion.ts` và dùng chung cho CSS lẫn canvas, nên bản ghi giống giao diện.

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
