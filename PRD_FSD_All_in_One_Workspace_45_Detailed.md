All-in-One Workspace PRD 

# **Đ C T Ả YÊU C Ầ U CH Ứ C NĂNG CHI TI Ế Ặ T (PRD / FSD)** 

**H Ệ TH Ố NG ALL-IN-ONE WORKSPACE (45 CH Ứ C NĂNG THEO CHU Ẩ N NEXDROP FORMAT)** 

## **PH Ầ N 1: T Ổ CH Ứ C KHÔNG GIAN, TÀI LI Ệ U & QU Ả N LÝ T Ệ P (WORKSPACE & DOCUMENTS)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`WS-OVW-01`**|**1. Tổng quan sản phẩm**|**Purpose**<br>Xây dựng nền tảng All-in-One Workspace thống nhất kết hợp mô hình Google<br>Drive, Notion, Excel, Kanban và Calendar/Timeline đểloại bỏphân mảnh thông<br>tin nội bộ.<br>**Business Logic- Luồng End-to-End**<br>Người dùng truy cập nền tảng và chọn không gian làm việc.<br>Hệthống hiển thịthanh điều hướng thống nhất gom chung: Project, Folder,<br>File, Task, QA/QC, API Doc, Config và Discussion.<br>Mọi thay đổi dữliệu từmột nguồn lập tức đồng bộtrên toàn bộcác công cụ<br>liên quan.<br>**Metrics**<br>Tốc độchuyển đổi giữa các module < 500ms.<br>Độsẵn sàng hệthống (Uptime) đạt 99.9%.<br>**Edge Cases**<br>Mất kết nối mạng: Chuyển sang chếđộRead-only ngoại tuyến và cảnh báo<br>chưa đồng bộ.<br>1.<br>2.<br>3.<br>•<br>•<br>•|
|**`WS-ARC-02`**|**2. Kiến trúc Workspace**<br>**& Project**|**Purpose**<br>Thiết lập phân tầng quản trịcao nhất: Workspace → Project → Folder →<br>Content.<br>**Business Logic- Luồng End-to-End**<br>Super Admin khởi tạo Workspace (VD: NexDrop Workspace) đểquản lý thành<br>viên, role, audit log.<br>Người dùng có quyền tạo các Project độc lập (VD: NexDrop Express,<br>NexDrop Station, Internal Tools).<br>Mỗi Project sởhữu cây Folder, nội dung và quyền truy cập độc lập.<br>Quản trịviên có thểchuyển trạng thái Project: Active, Archived, Restored,<br>Moved to Trash.<br>**Metrics**<br>Hỗtrợkhông giới hạn sốlượng Project trong 1 Workspace.<br>Chuyển trạng thái Project hoàn tất trong vòng < 1s.<br>**Edge Cases**<br>Xóa Project đang có thành viên làm việc: Bắt buộc nhập lại tên Project đểxác<br>nhận.<br>1.<br>2.<br>3.<br>4.<br>•<br>•<br>•|



1 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`WS-FLD-03`**|**3. Cây thư mục (Folder**<br>**Tree)**|**Purpose**<br>Tổchức dữliệu lồng nhau đa cấp tương tựGoogle Drive đểphân nhóm tài<br>nguyên theo phòng ban/tính năng.<br>**Business Logic- Luồng End-to-End**<br>Người dùng tạo cấu trúc Folder phân cấp (VD: NexDrop Express /<br>Development / Backend / Payment).<br>Folder có thểchứa: Folder con, Document, Board, File, Config Document,<br>Secret Document.<br>Hỗtrợcác thao tác: Tạo, Đổi tên, Kéo thảdi chuyển, Duplicate, Archive, Xóa<br>mềm (Trash), Share.<br>**Metrics**<br>Hỗtrợđộsâu cây thưmục tối thiểu 10 cấp không giới hạn node.<br>Thao tác kéo thảcập nhật parentId hoàn thành < 300ms.<br>**Edge Cases**<br>Kéo Folder cha vào chính Folder con của nó: Chặn thao tác và báo lỗi cấu<br>trúc vòng lặp.<br>1.<br>2.<br>3.<br>•<br>•<br>•|
|**`WS-NAV-04`**|**4. Breadcrumb &**<br>**Navigation**|**Purpose**<br>Giúp người dùng định vịvịtrí hiện tại trong cây thưmục và chuyển hướng tức<br>thì.<br>**Business Logic- Luồng End-to-End**<br>Hệthống hiển thịBreadcrumb động dạng path:<br>`NexDrop / Development /`<br>`Backend / Payment / API Documentation`.<br>Người dùng click vào bất kỳ cấp nào trên Breadcrumb đểnhảy trực tiếp về<br>Folder đó.<br>Sidebar bên trái cung cấp menu điều hướng nhanh: Workspace, Projects,<br>Favorites, Recent, My Work, Notifications, Archived, Trash.<br>**Metrics**<br>Độtrễcập nhật đường dẫn Breadcrumb < 100ms.<br>**Edge Cases**<br>Folder cha bịxóa khi user đang xem Folder con: Tựđộng redirect vềProject<br>root.<br>1.<br>2.<br>3.<br>•<br>•|
|**`WS-DOC-05`**|**5. Page / Document**|**Purpose**<br>Cung cấp trang soạn thảo văn bản dạng khối (Block-based) đểviết tài liệu quy<br>trình, mô tảkỹthuật.<br>**Business Logic- Luồng End-to-End**<br>Người dùng tạo Document mới trong Folder.<br>Hỗtrợcác block cơbản: Heading (H1, H2, H3), Paragraph, Checklist, Bullet/<br>Number List, Quote, Code Block, Image, Attachment, Link, Table cơbản.<br>Người dùng có thểthực hiện: Pin lên đầu, Lock (chống sửa), Duplicate,<br>Move, Archive, Delete.<br>**Metrics**<br>Tựđộng lưu (Auto-save) sau mỗi 500ms khi ngừng gõ.<br>Tải trang tài liệu < 500ms với tài liệu dài 50 trang.<br>**Edge Cases**<br>Document bịLock: Vô hiệu hóa toàn bộthanh công cụsoạn thảo, chỉhiển thị<br>chếđộđọc.<br>1.<br>2.<br>3.<br>•<br>•<br>•|



2 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`WS-FIL-06`**|**6. Quản lý Tệp tin (File**<br>**Management)**|**Purpose**<br>Lưu trữ, phân loại và xem trước trực tiếp các tệp tin đính kèm mà không cần tải<br>vềmáy.<br>**Business Logic- Luồng End-to-End**<br>Người dùng kéo thảfile từmáy tính vào Folder (PDF, PNG, JPG, XLSX, CSV,<br>Text, Source code).<br>Hệthống upload lên Cloud Storage (S3), sinh URL và lưu metadata: Tên, loại,<br>kích thước, owner, ngày tạo.<br>Người dùng click vào file đểmởtrình Preview trực tiếp trên trình duyệt (PDF/<br>Ảnh).<br>**Metrics**<br>Hỗtrợfile đơn lẻdung lượng tối đa 100MB.<br>Tốc độtải Preview < 1s đối với file PDF/Ảnh chuẩn.<br>**Edge Cases**<br>Định dạng file không hỗtrợPreview (.exe, .zip): Hiển thịnút Tải vềtrực tiếp<br>kèm cảnh báo.<br>1.<br>2.<br>3.<br>•<br>•<br>•|



## **PH Ầ N 2: LÕI D Ữ LI Ệ U B Ả NG & ĐA D Ạ NG C Ộ T (TABLE ENGINE & CELL TYPES)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`BD-COR-07`**|**7. Board – Lõi dữ liệu**<br>**hệ thống**|**Purpose**<br>Đóng vai trò là nguồn dữliệu duy nhất (Single Source of Truth) hỗtrợchuyển đổi<br>đa góc nhìn hiển thị.<br>**Business Logic- Luồng End-to-End**<br>Người dùng tạo một Board dữliệu (VD: Task Board, QA Board).<br>Dữliệu Board có thểhiển thịdưới 4 view: Table, Kanban, Calendar, Timeline.<br>Mọi thao tác chỉnh sửa ô, thêm dòng, đổi trạng tháiởbất kỳ View nào cũng<br>phản ánh vào cùng 1 Board record.<br>**Metrics**<br>Đồng bộtrạng thái giữa các View trong vòng 0ms (Local State) và < 300ms<br>(Backend).<br>**Edge Cases**<br>Xung đột đồng thời khi 2 người sửa 1 ô: Áp dụng cơchếLast-Write-Wins<br>hoặc thông báo xung đột.<br>1.<br>2.<br>3.<br>•<br>•|



3 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`BD-TBL-08`**|**8. Table View – Excel**<br>**Mode**|**Purpose**<br>Giao diện nhập liệu dạng bảng lưới siêu tốc với cấu trúc cột động không cốđịnh<br>schema cứng.<br>**Business Logic- Luồng End-to-End**<br>Người dùng mởTable View, thực hiện: Thêm Row, Xóa Row, Duplicate Row.<br>Người dùng tùy chỉnh cột: Thêm Cột mới, Đổi tên Header, Đổi Cell Type,<br>Resize chiều rộng, Kéo thảđổi vịtrí cột,Ẩn/Hiện cột.<br>Hỗtrợcopy/paste nhiều ô dữliệu cùng lúc giống Excel thuần túy.<br>**Metrics**<br>Render mượt mà 5.000 dòng dữliệu sửdụng kỹthuật Virtual Scrolling (DOM<br>Virtualization).<br>**Edge Cases**<br>Đổi loại cột từText sang Date: Kiểm tra parse format, nếu lỗi giữnguyên text<br>và cảnh báo format sai.<br>1.<br>2.<br>3.<br>•<br>•|
|**`BD-CEL-09`**|**9. Cell Types (Hệ thống**<br>**loại ô)**|**Purpose**<br>Đặc tảvà kiểm soát ràng buộc dữliệu cho 7 loại ô nhập liệu thông minh.<br>**Business Logic- Luồng End-to-End**<br>**Text / Long Text:**Nhập văn bản ngắn hoặc ghi chú dài.<br>**Select / Dropdown:**Menu thảxuống có màu riêng (To-do, Doing, GET,<br>POST). Cho phép gõ từmới đểtạo Option tức thì.<br>**Date:**Chọn Date hoặc Date+Time (Start Date, Due Date, End Date).<br>**User:**Chọn thành viên Workspace (Assignee, Reviewer, Tester).<br>**Attachment / Media:**Kéo thảnhiềuảnh cùng lúc vào 1 ô, hiển thịthumbnail<br>thu nhỏphục vụQA/Bug Evidence.<br>**Relation:**Liên kết dòng sang Board khác.<br>**Metrics**<br>Thả5ảnh cùng lúc vào ô: Tải lên song song và render thumbnail < 2s.<br>**Edge Cases**<br>User bịxóa khỏi Workspace: Giữnguyên tên hiển thịtrong ô kèm nhãn<br>(Inactive).<br>1.<br>2.<br>3.<br>4.<br>5.<br>6.<br>•<br>•|
|**`BD-RID-10`**|**10. Custom Row ID**|**Purpose**<br>Tựđộng sinh mã định danh duy nhất có Prefix cho từng dòng đểreference<br>nhanh trong giao tiếp nội bộ.<br>**Business Logic- Luồng End-to-End**<br>Cấu hình Prefix cho Board (VD: Task Board → TASK, Bug Board → BUG, QA<br>→ QA).<br>Khi tạo dòng mới, hệthống tựđộng sinh ID tăng dần: TASK-001, TASK-002,<br>QA-128.<br>Sửdụng ID đểtìm kiếm toàn cục, gắn liên kết hoặc trao đổi trong Comment<br>(VD: "QA-128 Failed do BUG-042").<br>**Metrics**<br>Đảm bảo tính Unique 100%, không trùng lặp ID khi nhiều user tạo dòng đồng<br>thời (Atomic counter).<br>**Edge Cases**<br>Xóa dòng TASK-005: Không tái sửdụng mã số005 cho dòng tiếp theo để<br>tránh sai lệch dữliệu lịch sử.<br>1.<br>2.<br>3.<br>•<br>•|



4 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`BD-DRW-11`**|**11. Drawer Detail (Cửa**<br>**sổ trượt)**|**Purpose**<br>Mởrộng toàn bộthông tin chi tiết của 1 record mà không cần điều hướng rời<br>khỏi View hiện tại.<br>**Business Logic- Luồng End-to-End**<br>Người dùng click vào 1 dòngởTable hoặc 1 CardởKanban.<br>Drawer trượt ra từbên phải màn hình hiển thị: Custom ID, Title, Status,<br>Assignee, Priority, Dates, Description (Rich text), Attachments, Relations,<br>Comments, Activity Log.<br>Mọi chỉnh sửa trong Drawer tựđộng lưu và cập nhật ngay vào bảng bên<br>dưới.<br>**Metrics**<br>Tốc độmởDrawer < 200ms.<br>**Edge Cases**<br>Đóng Drawer khi đang gõ comment chưa gửi: Lưu bản nháp (Draft) tạm thời<br>vào Local Storage.<br>1.<br>2.<br>3.<br>•<br>•|



## **PH Ầ N 3: ĐA GÓC NHÌN & TÙY BI Ế N D Ữ LI Ệ U (VIEWS & QUERY ENGINE)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`VW-KAN-12`**|**12. Kanban View**|**Purpose**<br>Trực quan hóa luồng công việc theo các cột trạng thái dạng thẻkéo thả.<br>**Business Logic- Luồng End-to-End**<br>Người dùng bật Kanban View và chọn cột Select đểGroup (VD: Status: To-<br>do, Doing, Done).<br>Hệthống sinh các cột dọc tươngứng với từng option.<br>Người dùng kéo thảCard từcột "Doing" sang "Done" → Giá trịStatus của<br>Row tươngứng trong Table tựđộng cập nhật.<br>**Metrics**<br>Animation kéo thảmượt mà đạt 60fps.<br>**Edge Cases**<br>Kéo thẻvào cột mà user không có quyền chuyển: Thẻtựđộng bật ngược lại<br>vịtrí cũ kèm thông báo.<br>1.<br>2.<br>3.<br>•<br>•|
|**`VW-CAL-13`**|**13. Calendar View**|**Purpose**<br>Quản lý thời hạn công việc trực quan theo dạng lịch tháng.<br>**Business Logic- Luồng End-to-End**<br>Người dùng chọn một cột Date (VD: Due Date) làm căn cứánh xạ.<br>Các task xuất hiện tại đúng ô ngày tươngứng trên Month Calendar.<br>Click vào thẻtrên lịch mởngay Drawer Detail. Kéo thẻsang ngày khác cập<br>nhật lại Due Date.<br>**Metrics**<br>Chuyển đổi giữa các tháng tải dữliệu < 300ms.<br>**Edge Cases**<br>Dòng không có ngày (Due Date rỗng): Gom vào danh sách "Unscheduled"ở<br>góc lịch.<br>1.<br>2.<br>3.<br>•<br>•|



5 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`VW-TIM-14`**|**14. Timeline View**<br>**(Gantt Chart)**|**Purpose**<br>Theo dõi tiến độtổng thể, phát hiện công việc kéo dài và sựchồng chéo thời<br>gian.<br>**Business Logic- Luồng End-to-End**<br>Timeline sửdụng cặp trường Start Date + End Date đểvẽthanh bar trải dài<br>theo trục thời gian.<br>Người dùng quan sát được các đầu việc đang chạy đồng thời hoặc bịchậm<br>trễ.<br>Hỗtrợkéo giãn 2 đầu thanh bar đểgia hạn hoặc rút ngắn Start/End Date trực<br>tiếp.<br>**Metrics**<br>Phóng to/thu nhỏ(Zoom) theo Ngày/Tuần/Tháng phản hồi tức thì < 200ms.<br>**Edge Cases**<br>Start Date lớn hơn End Date: Tựđộng đảo lại giá trịvà cảnh báo người dùng.<br>1.<br>2.<br>3.<br>•<br>•|
|**`VW-FLT-15`**|**15. Bộ lọc (Filter**<br>**Engine)**|**Purpose**<br>Truy vấn và sàng lọc dữliệu chính xác theo nhiều điều kiện logic kết hợp.<br>**Business Logic- Luồng End-to-End**<br>Người dùng thiết lập điều kiện lọc (VD:<br>`Status != Done AND Priority =`<br>`High AND Assignee = Thanh`).<br>Hệthống áp dụng bộlọc tức thì trên Table, Kanban, Calendar và Timeline.<br>**Metrics**<br>Thời gian lọc p95 < 200ms trên tập dữliệu 5.000 dòng.<br>**Edge Cases**<br>Bộlọc không có kết quả: Hiển thịtrạng thái rỗng và nút "Xóa toàn bộbộlọc".<br>1.<br>2.<br>•<br>•|
|**`VW-SRT-16`**|**16. Sắp xếp (Sort**<br>**Engine)**|**Purpose**<br>Sắp xếp thứtựhiển thịcủa các dòng dữliệu theo thứtự ưu tiên hoặc thời gian.<br>**Business Logic- Luồng End-to-End**<br>Người dùng chọn 1 hoặc nhiều cột đểsắp xếp (Multi-level Sort).<br>Ví dụ: Cấp 1 sắp xếp theo<br>`Priority DESC`,Cấp 2 sắp xếp theo<br>`Due Date`<br>`ASC`.<br>**Metrics**<br>Tốc độsắp xếp dữliệu < 100ms.<br>**Edge Cases**<br>Ô có giá trịNull/Rỗng: Luôn tựđộng đưa vềcuối danh sách.<br>1.<br>2.<br>•<br>•|



6 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`VW-GRP-17`**|**17. Phân nhóm (Group**<br>**Engine)**|**Purpose**<br>Gom nhóm các dòng dữliệu trong Table thành từng phân đoạn đểdễquản lý.<br>**Business Logic- Luồng End-to-End**<br>Người dùng chọn Group theo: Status, Priority, Assignee, Sprint hoặc<br>Environment.<br>Bảng tựđộng chia thành các Block gom nhóm có thểđóng/mở(Collapse/<br>Expand).<br>**Metrics**<br>Đóng/mởnhóm phản hồi < 50ms.<br>**Edge Cases**<br>Nhóm không có phần tử:Ẩn nhóm hoặc hiển thịcount = 0 theo tùy chọn.<br>1.<br>2.<br>•<br>•|
|**`VW-SAV-18`**|**18. Lưu cấu hình View**<br>**(Saved Views)**|**Purpose**<br>Lưu trữcác góc nhìn, bộlọc và cách sắp xếp yêu thích thành các Tab truy cập<br>nhanh.<br>**Business Logic- Luồng End-to-End**<br>Người dùng cấu hình View (chọn View Type, Filter, Sort, Group,Ẩn/Hiện cột).<br>Bấm "Lưu View" và đặt tên (VD: "My Tasks", "Backend Bugs", "This Sprint").<br>Saved View xuất hiện thành các Tabởđầu Board đểchuyển đổi tức thì.<br>**Metrics**<br>Chuyển qua lại giữa các Saved View < 300ms.<br>**Edge Cases**<br>Cột bịxóa trong cấu hình Saved View: Tựđộng loại bỏđiều kiện lọc của cột<br>đó và giữnguyên View.<br>1.<br>2.<br>3.<br>•<br>•|



## **PH Ầ N 4: TEMPLATES, DEV TOOLS & LIÊN K Ế T D Ữ LI Ệ U (INTEGRATION & RELATIONS)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`DV-TMP-19`**|**19. Board Templates**|**Purpose**<br>Cung cấp các mẫu cấu trúc bảng dựng sẵn chuẩn hóa đểtạo luồng việc trong 1<br>click.<br>**Business Logic- Luồng End-to-End**<br>Người dùng chọn tạo Board từmẫu có sẵn: Task Template, Bug Template,<br>QA/QC Template, API Documentation Template.<br>Hệthống tựđộng sinh toàn bộcột, định dạng màu enum và Custom Row ID<br>prefix chuẩn.<br>**Metrics**<br>Thời gian sinh Board từTemplate < 1s.<br>**Edge Cases**<br>User tùy chỉnh xóa bớt cột trong template: Vẫn cho phép và khôngảnh hưởng<br>đến template gốc.<br>1.<br>2.<br>•<br>•|



7 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`DV-API-20`**|**20. API Documentation**<br>**Board**|**Purpose**<br>Quản lý và tra cứu danh mục endpoint nội bộgọn gàng, không làm phức tạp<br>hóa nhưAPI Gateway.<br>**Business Logic- Luồng End-to-End**<br>Tạo Board lưu API chứa các cột: API ID, Domain(<br>`api.nexdrop.vn`),<br>Endpoint (<br>`/auth/login`), Method (GET/POST/PUT tag màu), Description,<br>Auth, Owner.<br>Phục vụlàm tài liệu tra cứu trực tiếp cho team Frontend/Mobile.<br>**Metrics**<br>Tìm kiếm nhanh endpoint < 100ms.<br>**Edge Cases**<br>Trùng lặp Endpoint + Method: Cảnh báo visual màu vàng đểdev kiểm tra lại.<br>1.<br>2.<br>•<br>•|
|**`DV-ENV-21`**|**21. Gắn nhãn Môi**<br>**trường (Environment)**|**Purpose**<br>Phân định rõ ràng phạm vi tác động của Bug, QA, API và Config theo từng môi<br>trường triển khai.<br>**Business Logic- Luồng End-to-End**<br>Hỗtrợ3 nhãn chuẩn: Development, Staging, Production.<br>Được tích hợp vào dropdown của Bug, QA test cases và Config Document.<br>**Metrics**<br>Filter nhanh dữliệu theo Prod < 100ms.<br>**Edge Cases**<br>Thay đổi cấu hình Prod: Bắt buộc yêu cầu xác nhận role Admin/Manager.<br>1.<br>2.<br>•<br>•|
|**`DV-CFG-22`**|**22. Config Document**|**Purpose**<br>Lưu trữcấu hình hệthống và biến môi trường không nhạy cảm dưới dạng Text/<br>Code Editor.<br>**Business Logic- Luồng End-to-End**<br>Người dùng tạo Config Doc (VD:<br>`PORT=6868, API_URL=https://...`).<br>Hệthống lưu trữdạng Raw Text/Code có tô màu cú pháp (Syntax<br>Highlighting).<br>HỗtrợVersion History và khôi phục phiên bản cũ khi xảy ra lỗi cấu hình.<br>**Metrics**<br>Lưu lịch sửthay đổi phiên bản 100% không sót lần edit nào.<br>**Edge Cases**<br>Nhập chuỗi JSON cấu hình sai cú pháp: Editor gạch chân đỏcảnh báo lỗi.<br>1.<br>2.<br>3.<br>•<br>•|



8 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`DV-SEC-23`**|**23. Secret Document**|**Purpose**<br>Bảo vệcác dữliệu cực kỳ nhạy cảm (Password, JWT Secret, Private Key) với cơ<br>chếmặt nạhiển thị.<br>**Business Logic- Luồng End-to-End**<br>Dữliệu nhạy cảm được mã hóa khi lưu. Giao diện hiển thịdạng mặt nạ:<br>`DATABASE_PASSWORD = ************`.<br>Người dùng có quyền (Role Admin/Manager) bấm nút "Reveal" (Con mắt)<br>hoặc "Copy" đểlấy text thật.<br>Mọi thao tác Reveal/Copy tựđộng ghi nhận vào Workspace Audit Log.<br>**Metrics**<br>100% hành vi Reveal/Copy phải sinh Audit Log kèm IP và Timestamp.<br>**Edge Cases**<br>Role Member/Viewer cốtình bấm Reveal: Chặn API và trảvềlỗi 403<br>Forbidden.<br>1.<br>2.<br>3.<br>•<br>•|
|**`DV-REL-24`**|**24. Relation & Backlink**|**Purpose**<br>Hình thành mạng lưới dữliệu 2 chiều giữa các Board khác nhau trong hệthống.<br>**Business Logic- Luồng End-to-End**<br>Liên kết 1 dòngởBoard này sang Board khác (VD: QA-128 liên kết tới<br>TASK-042).<br>Tại Drawer của TASK-042, hệthống tựđộng hiển thịBacklink ngược lại:<br>"Related QA: QA-128", "Related Bug: BUG-021".<br>**Metrics**<br>Tựđộng cập nhật Backlink 2 chiều trong < 200ms.<br>**Edge Cases**<br>Dòng đích bịxóa: Hiển thịnhãn [Deleted Item] trên ô Relation kèm tùy chọn<br>gỡlink.<br>1.<br>2.<br>•<br>•|
|**`DV-EMB-25`**|**25. Embedded Board**<br>**View**|**Purpose**<br>Nhúng trực tiếp một Saved View của Board vào trang Document mà không làm<br>duplicate dữliệu.<br>**Business Logic- Luồng End-to-End**<br>Trong trang Document, người dùng gõ slash command đểnhúng Saved View<br>(VD: Nhúng API Board có Filter: Module=Payment).<br>Dữliệu hiển thịtrực tiếp từBoard gốc. Thay đổi trong view nhúng lập tức cập<br>nhật Board gốc.<br>**Metrics**<br>Tốc độtải embedded view < 400ms.<br>**Edge Cases**<br>Board gốc bịxóa: Khối nhúng hiển thịcảnh báo "Board không tồn tại hoặc đã<br>bịxóa".<br>1.<br>2.<br>•<br>•|



9 

All-in-One Workspace PRD 

## **PH Ầ N 5: GIAO TI Ế P, THÔNG BÁO & DASHBOARD (COLLABORATION & NAVIGATION)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`CO-CMT-26`**|**26. Trao đổi & Bình luận**<br>**(Comments)**|**Purpose**<br>Thảo luận và ghi chú trực tiếp theo đúng ngữcảnh của từng Task/Row.<br>**Business Logic- Luồng End-to-End**<br>MởDrawer Detail của Row, chuyển đến khu vực Comments.<br>Người dùng gửi bình luận, reply phân luồng, đính kèm hìnhảnh/file.<br>**Metrics**<br>Tin nhắn comment hiển thịrealtime cho các user đang mởdrawer trong <<br>500ms.<br>**Edge Cases**<br>User sửa comment: Gắn nhãn "(đã chỉnh sửa)" và lưu lại lịch sửsửa.<br>1.<br>2.<br>•<br>•|
|**`CO-MEN-27`**|**27. Gắn thẻ thành viên**<br>**(@Mention)**|**Purpose**<br>Kêu gọi đích danh thành viên vào thảo luận đểxửlý công việc nhanh chóng.<br>**Business Logic- Luồng End-to-End**<br>Gõ ký tự<br>`@`trong Comment hoặc Document.<br>Popup danh sách thành viên hiện ra, gõ tên đểfilter và chọn.<br>Người được mention nhận thông báo đẩy tức thì vào Notification Center.<br>**Metrics**<br>Tìm kiếm tên thành viên trong danh sách < 100ms.<br>**Edge Cases**<br>Tag thành viên không có quyền xem Board đó: Hệthống nhắc nhởcấp quyền<br>truy cập.<br>1.<br>2.<br>3.<br>•<br>•|
|**`CO-WAT-28`**|**28. Theo dõi (Follow /**<br>**Watch👁)**|**Purpose**<br>Cho phép thành viên chủđộng theo dõi tiến độcông việc quan trọng dù không<br>trực tiếp được Assign.<br>**Business Logic- Luồng End-to-End**<br>Bấm nút "👁Watch" trên Row, Document hoặc Board.<br>Hệthống tựđộng gửi thông báo khi thực thểcó thay đổi (đổi status, có<br>comment mới, cập nhật deadline).<br>**Metrics**<br>Bật/tắt Watch có hiệu lực ngay lập tức trong < 100ms.<br>**Edge Cases**<br>Tài nguyên bịxóa: Tựđộng gỡkhỏi danh sách Following của user.<br>1.<br>2.<br>•<br>•|



10 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`CO-NOT-29`**|**29. Trung tâm thông**<br>**báo (Notification**<br>**Center)**|**Purpose**<br>Quản lý và phân loại tập trung toàn bộthông báo hệthống, tránh sót việc.<br>**Business Logic- Luồng End-to-End**<br>Icon chuông thông báoởgóc màn hình gom tin theo 4 tab:**All, Mentions,**<br>**Assigned, Following**.<br>Tựđộng đẩy cảnh báo: "Deadline tomorrow: TASK-81", "BUG-042 was<br>assigned to you".<br>Click vào thông báo chuyển thẳng đến đúng dòng/tài liệu tươngứng.<br>**Metrics**<br>Đẩy thông báo realtime qua WebSocket < 500ms.<br>**Edge Cases**<br>Bấm "Đánh dấu đã đọc tất cả": Cập nhật toàn bộbadge về0 trong < 200ms.<br>1.<br>2.<br>3.<br>•<br>•|
|**`CO-MYW-30`**|**30. Dashboard Cá nhân**<br>**(My Work)**|**Purpose**<br>Trang chủcá nhân hóa giúp thành viên nắm bắt ngay các việc cần xửlý mà<br>không phải lội vào từng Board.<br>**Business Logic- Luồng End-to-End**<br>Truy cập mục "My Work" tại Sidebar.<br>Hiển thịcác widget đếm sốlượng thông minh: Assigned to Me, Mentioned,<br>Due Today, Overdue, Recently Updated.<br>Click vào thẻđểmởngay việc cần làm.<br>**Metrics**<br>Tổng hợp sốliệu My Work toàn hệthống < 1s.<br>**Edge Cases**<br>Không có task nào đến hạn: Hiển thịthông điệp "Hôm nay bạn không có<br>deadline nào!".<br>1.<br>2.<br>3.<br>•<br>•|
|**`CO-SCH-31`**|**31. Tìm kiếm toàn cục**<br>**(Global Search)**|**Purpose**<br>Tra cứu tức thì mọi nội dung trên toàn bộWorkspace chỉvới 1 thanh search duy<br>nhất.<br>**Business Logic- Luồng End-to-End**<br>Nhấn phím tắt<br>`Ctrl + K` (hoặc<br>`Cmd + K`).<br>Nhập từkhóa (VD: "payment callback").<br>Hệthống quét và phân loại kết quả: Document, API, Bug, QA, Row ID, File,<br>Comment.<br>**Metrics**<br>Thời gian trảvềkết quảtìm kiếm < 300ms.<br>**Edge Cases**<br>Chỉhiển thịcác kết quảthuộc phạm vi tài nguyên mà User có quyền truy cập.<br>1.<br>2.<br>3.<br>•<br>•|



11 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`CO-FAV-32`**|**32. Mục yêu thích**<br>**(Favorites)**|**Purpose**<br>Đánh dấu và ghim nhanh các dựán, thưmục, bảng làm việc thường xuyên sử<br>dụng.<br>**Business Logic- Luồng End-to-End**<br>Bấm icon sao<br>`Favorite`<br> trên Project, Folder, Document hoặc Board.<br>Tài nguyên xuất hiện ngay tại khu vực Favorites trên thanh Sidebar đểmở<br>nhanh.<br>**Metrics**<br>Gắn/gỡsao phản hồi tức thì trong < 100ms.<br>**Edge Cases**<br>Tài nguyên Favorite bịxóa: Tựđộng gỡkhỏi danh sách Favorites.<br>1.<br>2.<br>•<br>•|
|**`CO-REC-33`**|**33. Truy cập gần đây**<br>**(Recent)**|**Purpose**<br>Lưu lịch sửcác tài nguyên vừa thao tác giúp quay lại công việc đang dởdang<br>cực nhanh.<br>**Business Logic- Luồng End-to-End**<br>Hệthống tựđộng ghi nhận mỗi khi user mởDocument, Board, Config hoặc<br>Folder.<br>Hiển thịdanh sách 10 mục gần nhất tại Sidebar mục "Recent".<br>**Metrics**<br>Cập nhật danh sách Recent trong vòng < 100ms sau khi mởtài nguyên.<br>**Edge Cases**<br>Danh sách đạt tối đa: Tựđộng loại bỏmục cũ nhất theo cơchếLRU (Least<br>Recently Used).<br>1.<br>2.<br>•<br>•|



## **PH Ầ N 6: THAO TÁC D Ữ LI Ệ U NÂNG CAO, PHÂN QUY Ề N & H Ệ TH Ố NG (SYSTEM ENGINE & RBAC)** 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`SY-BLK-34`**|**34. Thao tác hàng loạt**<br>**(Bulk Actions)**|**Purpose**<br>Tốiưu hóa năng suất xửlý dữliệu bằng cách tác động lên nhiều dòng cùng lúc.<br>**Business Logic- Luồng End-to-End**<br>Tick chọn checkbox nhiều dòng trên Table (VD: TASK-01, TASK-02,<br>TASK-03).<br>Thanh công cụBulk Actions nổi lên cho phép: Đổi Status, Gán Assignee, Di<br>chuyển Board, Archive, Xóa, Export.<br>**Metrics**<br>Xửlý đồng thời 100 dòng hoàn tất trong < 1.5s.<br>**Edge Cases**<br>Trong các dòng được chọn có dòng user không có quyền sửa: Báo lỗi và chỉ<br>cập nhật các dòng hợp lệ.<br>1.<br>2.<br>•<br>•|



12 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`SY-IMP-35`**|**35. Nhập dữ liệu**<br>**(Import Data)**|**Purpose**<br>Hỗtrợdi chuyển dữliệu từExcel/CSV bên ngoài vào Board một cách mượt mà.<br>**Business Logic- Luồng End-to-End**<br>Tải lên file Excel (.xlsx) hoặc CSV.<br>Hệthống mởmàn hình Mapping cột (VD: Cột file "Task Name" → Cột Board<br>"Task", Cột "Due" → "Due Date").<br>Bấm Xác nhận import → Dữliệu đổvào Board và tựsinh Custom ID.<br>**Metrics**<br>Import 1.000 dòng dữliệu < 3s.<br>**Edge Cases**<br>Dòng chứa giá trịDate sai định dạng: Giữô rỗng hoặc báo lỗi dòng cụthể<br>cho user chọn sửa.<br>1.<br>2.<br>3.<br>•<br>•|
|**`SY-EXP-36`**|**36. Xuất dữ liệu (Export**<br>**Data)**|**Purpose**<br>Kết xuất dữliệu Board ra file phục vụbáo cáo, đối soát và lưu trữnội bộ.<br>**Business Logic- Luồng End-to-End**<br>Người dùng chọn Xuất file: Định dạng Excel, CSV hoặc PDF.<br>Phạm vi xuất: Toàn bộBoard, Current View (chỉxuất các dòng đang lọc) hoặc<br>Các dòng đã chọn.<br>Hệthống sinh file đúng định dạng và tải vềmáy.<br>**Metrics**<br>Xuất file Excel 5.000 dòng < 2s.<br>**Edge Cases**<br>User không có quyền xem cột Secret: Tựđộng loại bỏcột đó khỏi file xuất.<br>1.<br>2.<br>3.<br>•<br>•|
|**`SY-ARC-37`**|**37. Lưu trữ (Archive)**|**Purpose**<br>Đóng băng các dữliệu dựán/tài liệu đã hoàn tất nhưng vẫn cần lưu trữtra cứu<br>lịch sử.<br>**Business Logic- Luồng End-to-End**<br>Thực hiện Archive cho: Project, Folder, Board, Document.<br>Dữliệu bị ẩn khỏi màn hình làm việc chính và chuyển sang trạng thái Read-<br>only (chỉđọc, không sửa được).<br>Người dùng có quyền có thểbấm "Restore" bất cứlúc nào đểkích hoạt lại.<br>**Metrics**<br>Chuyển trạng thái Archive < 500ms.<br>**Edge Cases**<br>Thực thểđang bịArchive: Vô hiệu hóa tính năng thêm dòng mới hoặc sửa đổi<br>nội dung.<br>1.<br>2.<br>3.<br>•<br>•|



13 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`SY-TRH-38`**|**38. Thùng rác & Xóa**<br>**mềm (Trash / Soft**<br>**Delete)**|**Purpose**<br>Ngăn ngừa rủi ro mất mát dữliệu do thao tác xóa nhầm của người dùng.<br>**Business Logic- Luồng End-to-End**<br>Khi xóa Folder, Document, Board, File → Chuyển vào Trash (Soft delete, gắn<br>cờ<br>`isDeleted=true`).<br>Dữliệu trong Trash được lưu giữ30 ngày trước khi tựđộng dọn dẹp.<br>User có thể: Khôi phục (Restore) vềvịtrí cũ hoặc Xóa vĩnh viễn (Delete<br>Permanently).<br>**Metrics**<br>Khôi phục dữliệu từTrash hoàn tất trong < 500ms.<br>**Edge Cases**<br>Khôi phục 1 Document nhưng Folder cha của nó đã bịxóa vĩnh viễn: Khôi<br>phục Doc ra ngoài Root của Project.<br>1.<br>2.<br>3.<br>•<br>•|
|**`SY-VER-39`**|**39. Lịch sử phiên bản**<br>**(Version History)**|**Purpose**<br>Lưu trữlịch sửchỉnh sửa tài liệu và cấu hình đểso sánh và khôi phục khi cần<br>thiết.<br>**Business Logic- Luồng End-to-End**<br>Áp dụng cho Document, Config Document, Secret Document.<br>Hệthống lưu snapshot mỗi phiên bản theo mốc thời gian và người sửa.<br>Người dùng xem lại bản cũ, so sánh sựkhác biệt và bấm "Restore Version".<br>**Metrics**<br>Khôi phục phiên bản cũ hoàn tất trong < 500ms.<br>**Edge Cases**<br>So sánh 2 version: Tô màu xanh các đoạn text thêm mới, màu đỏcác đoạn<br>text bịxóa.<br>1.<br>2.<br>3.<br>•<br>•|
|**`SY-ACT-40`**|**40. Lịch sử dòng**<br>**(Activity History)**|**Purpose**<br>Ghi nhận minh bạch mọi biến động dữliệu chi tiết trên từng dòng/task của<br>Board.<br>**Business Logic- Luồng End-to-End**<br>Mọi thay đổi trên Row đều tựđộng ghi log vào Activity tab trong Drawer.<br>Ví dụ: "16:20 - Thanh đổi Status: Doing → Done", "16:15 - Nam đổi Due Date:<br>25/08 → 27/08", "16:02 - Thanh thêmảnh payment-error.png".<br>**Metrics**<br>Ghi log tựđộng 100% không làm tăng độtrễcủa API cập nhật dòng.<br>**Edge Cases**<br>Thay đổi nhiều trường cùng lúc: Gộp chung vào 1 record log duy nhất tại thời<br>điểm đó.<br>1.<br>2.<br>•<br>•|



14 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`SY-AUD-41`**|**41. Nhật ký bảo mật**<br>**(Workspace Audit Log)**|**Purpose**<br>Cung cấp công cụthanh tra bảo mật toàn diện dành riêng cho Super Admin.<br>**Business Logic- Luồng End-to-End**<br>Ghi nhận toàn bộthao tác nhạy cảm cấp hệthống: Xóa Board, Reveal<br>Secret, Thay đổi Role thành viên, Khôi phục Config.<br>Mỗi record lưu: Thời gian, Module, Hành động, Người thực hiện, Địa chỉIP,<br>Mức độ(Info/Warn/Error).<br>**Metrics**<br>Bảng Audit Log là Append-only (Tuyệt đối không cho phép sửa/xóa log). Thời<br>gian lưu trữ12 tháng.<br>**Edge Cases**<br>Chỉcó role Super Admin mới có quyền truy cập và xuất file Audit Log.<br>1.<br>2.<br>•<br>•|
|**`SY-RBC-42`**|**42. Phân quyền RBAC**<br>**(Role-Based Access**<br>**Control)**|**Purpose**<br>Kiểm soát chặt chẽquyền hạn thao tác trên hệthống theo 4 cấp bậc Role chuẩn.<br>**Business Logic- Luồng End-to-End**<br>**Viewer:**Chỉxem Folder, Doc, Board, File, Kanban. Không thểsửa ô, không<br>kéo thẻ, không thêm dòng/cột.<br>**Member:**Sửa dữliệu Cell, Thêm dòng, Comment, Kéo Kanban, Upload file.<br>Không sửa cấu trúc bảng, không quản lý Role.<br>**Manager:**Toàn bộquyền Member + Quản lý Board, Thêm/Sửa Cột, Quản lý<br>Doc/Template, Archive.<br>**Admin:**Toàn quyền Workspace: Quản lý Member/Role, Audit Log, Trash, Cấu<br>hình hệthống.<br>**Metrics**<br>Kiểm tra quyền hạn p99 < 10msởtầng Middleware/Guard.<br>**Edge Cases**<br>Người dùng bịhạquyền khi đang mởmàn hình: UI tựđộng vô hiệu hóa các<br>nút chức năng bịkhóa.<br>1.<br>2.<br>3.<br>4.<br>•<br>•|
|**`SY-INH-43`**|**43. Kế thừa quyền hạn**<br>**(Permission**<br>**Inheritance)**|**Purpose**<br>Tựđộng lan truyền quyền hạn từcấp cao xuống cấp con, giảm thiểu công sức<br>cấu hình thủcông.<br>**Business Logic- Luồng End-to-End**<br>Quyền được phân bổtheo thứbậc:<br>`Workspace → Project → Folder →`<br>`Content (Board/Doc/File)`.<br>Ví dụ: User được cấp quyền Manager tại Folder "Backend" thì tựđộng có<br>quyền Managerởtoàn bộBoard/File con bên trong.<br>Cho phép thiết lập "Override Permission" tại 1 tài nguyên con cụthểkhi cần<br>cô lập bảo mật.<br>**Metrics**<br>Duyệt cây quyền hạn kếthừa < 50ms khi truy vấn.<br>**Edge Cases**<br>Xung đột quyền giữa Group và User: Áp dụng mức quyền cao hơn (Union of<br>permissions).<br>1.<br>2.<br>3.<br>•<br>•|



15 

All-in-One Workspace PRD 

|**`Mã chức`**<br>**`năng`**|**Tên chức năng**|**Tiêu chí chấp nhận (Acceptance Criteria)**|
|---|---|---|
|**`SY-DSH-44`**|**44. Dashboard Tổng**<br>**quan**|**Purpose**<br>Cung cấp bức tranh toàn cảnh vềtiến độcông việc và chất lượng kiểm thửcủa<br>toàn bộWorkspace.<br>**Business Logic- Luồng End-to-End**<br>Hiển thịcác widget thống kê nhẹnhàng (không thay thếBI phức tạp):<br>**TASKS:**To-do (28), Doing (14), Review (5), Done (82).<br>**QA:**Passed (81%), Failed (12%), Blocked (7%).<br>**DEADLINE:**Overdue (4), Today (7), This Week (18).<br>**Metrics**<br>Thời gian tải Dashboard tổng quan < 1s.<br>**Edge Cases**<br>Dựán mới tạo chưa có dữliệu: Hiển thịtrạng thái khởi tạo kèm hướng dẫn<br>tạo task đầu tiên.<br>1.<br>2.<br>3.<br>4.<br>•<br>•|
|**`SY-POS-45`**|**45. Định vị sản phẩm**<br>**(Organize - Connect -**<br>**View)**|**Purpose**<br>Đảm bảo toàn bộhệthống luôn vận hành bám sát 3 trụcột giá trịcốt lõi đã định<br>vị.<br>**Business Logic- Luồng End-to-End**<br>**ORGANIZE:**Thống nhất mọi tài nguyên phân tán qua mô hình Workspace →<br>Project → Folder → Content.<br>**CONNECT:**Thiết lập mạng lưới liên kết chặt chẽgiữa Task, QA, Bug, API và<br>Document thông qua Relation & Backlink.<br>**VIEW:**Tốiưu hóa quan sát với 4 góc nhìn linh hoạt: Table, Kanban, Calendar,<br>Timeline trên cùng 1 nguồn dữliệu gốc.<br>**Metrics**<br>100% tính năng phát triển mới phải thỏa mãn ít nhất một trong ba trụcột<br>Organize - Connect - View.<br>**Edge Cases**<br>Ngăn chặn bổsung các tính năng ngoài phạm vi định vị(nhưWorkflow<br>Automation, API Gateway, Email Client).<br>1.<br>2.<br>3.<br>•<br>•|



16 

