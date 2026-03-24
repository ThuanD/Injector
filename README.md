# ⚡ Injector

> Tự động chạy JavaScript trên bất kỳ trang web nào — miễn phí, mã nguồn mở, không cần Chrome Web Store.

![Version](https://img.shields.io/badge/version-2.0.2-3dd6f5?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-7c6cf8?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-2dd4a0?style=flat-square)
![Price](https://img.shields.io/badge/price-free-f5a623?style=flat-square)

---

## Giới thiệu

**Injector** là Chrome extension cho phép bạn tự động chạy đoạn JavaScript bất kỳ mỗi khi mở một trang web cụ thể. Dùng để ẩn quảng cáo, tự điền form, theo dõi giá, nhận thông báo Telegram — và rất nhiều thứ khác.

Không cần biết lập trình. Extension có sẵn 20+ template, tích hợp prompt để nhờ ChatGPT viết script theo yêu cầu của bạn.

## Tính năng

- **Auto-inject Scripts** — Script tự động chạy khi load trang, hỗ trợ URL pattern với wildcard `*`
- **20+ Templates** — Dùng ngay không cần code: xóa quảng cáo, dark mode, monitor giá, clean YouTube/Facebook/Twitter...
- **AI-assisted** — Prompt mẫu tích hợp sẵn để nhờ ChatGPT/Gemini viết script theo yêu cầu
- **Hide Elements** — Ẩn phần tử theo CSS selector trực tiếp từ popup, không cần viết code
- **Telegram Notifications** — Nhận thông báo điện thoại khi giá thay đổi hoặc nội dung cập nhật
- **SPA Support** — Tự động detect URL thay đổi trong React/Vue/Next.js và re-run script đúng lúc
- **Export/Import** — Backup toàn bộ scripts ra JSON, chuyển sang máy khác dễ dàng
- **CSP Bypass** — Dùng kỹ thuật nonce stealing để chạy script trên các trang có Content Security Policy nghiêm ngặt

## Cài đặt

Vì extension không có trên Chrome Web Store (Google thu phí $5 developer), bạn cài tay theo 4 bước:

### Bước 1 — Tải về

Tải file ZIP từ nút **Code → Download ZIP** trên GitHub, hoặc clone:

```bash
git clone https://github.com/ThuanD/Injector.git
```

### Bước 2 — Giải nén

Giải nén file ZIP. Bạn sẽ có thư mục `Injector-main/`.

### Bước 3 — Bật Developer Mode

Mở Chrome, vào `chrome://extensions`, bật công tắc **Developer mode** góc trên bên phải.

### Bước 4 — Load extension

Nhấn **Load unpacked** → mở vào thư mục `Injector-main` → chọn tiếp thư mục con **`Injector-Extension`**.

Icon ⚡ sẽ xuất hiện trên toolbar — cài đặt hoàn tất.

## Cấu trúc project

```
Injector/
├── Injector-Extension/     # Source code extension
│   ├── manifest.json        # Manifest V3 config
│   ├── background.js        # Service worker: storage, messaging
│   ├── content.js           # Script runner: inject & execute
│   ├── popup.html/js        # Popup UI
│   ├── options.html/js      # Script manager (full UI)
│   ├── templates.js         # 20+ script templates
│   └── icons/               # Extension icons
├── index.html               # Landing page
├── og-image.png             # OG image cho social share
├── site.webmanifest         # Web app manifest
├── robots.txt
├── sitemap.xml
└── README.md
```

## Hướng dẫn sử dụng

### Dùng template có sẵn

1. Click icon ⚡ trên toolbar → **Manage All Scripts**
2. Vào tab **📋 Templates**, chọn template phù hợp
3. Điền **URL Pattern** — trang nào bạn muốn script chạy (ví dụ: `*.youtube.com`)
4. Nhấn **＋ Add Script** → reload trang là xong

### Viết script bằng AI

1. Vào tab **📖 Guide** trong Options page
2. Copy một trong các **prompt mẫu** theo loại việc bạn muốn làm
3. Paste vào ChatGPT, mô tả yêu cầu → nhận code
4. Tạo script mới, paste code vào, điền URL Pattern → lưu

### URL Pattern

| Pattern | Ý nghĩa |
|---|---|
| `*` | Chạy trên mọi trang |
| `*.youtube.com` | Mọi trang YouTube |
| `*.tiki.vn/product/*` | Chỉ trang sản phẩm Tiki |
| `https://docs.google.com/*` | Mọi Google Docs |

## Cảnh báo bảo mật

Script JavaScript có thể **đọc mọi nội dung trên trang**, bao gồm mật khẩu, cookie, thông tin thẻ ngân hàng.

- **Không** paste code từ người lạ gửi qua mạng xã hội, Zalo, Telegram
- **Không** chạy script trên trang ngân hàng, ví điện tử, trang đăng nhập quan trọng
- **Nên** đọc kỹ code hoặc nhờ ChatGPT giải thích trước khi chạy

## Đóng góp

Pull request và issue luôn được chào đón. Một số hướng đóng góp:

- Thêm template mới vào `templates.js`
- Fix bug, cải thiện tính năng
- Cải thiện UI/UX

## Ủng hộ

Nếu extension hữu ích với bạn, hãy ủng hộ tác giả một que Chupa Chups ☕

[![Buy me a Chupa Chups](https://img.shields.io/badge/Buy%20me%20a%20Chupa%20Chups-🍭-f5a623?style=flat-square)](https://www.buymeacoffee.com/thuandv)

## License

[MIT](LICENSE) — Tự do sử dụng, chỉnh sửa và phân phối.
