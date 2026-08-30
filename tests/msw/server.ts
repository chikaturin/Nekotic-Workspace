import { setupServer } from "msw/node";
import { boardHandlers } from "./handlers/board";
import { collabHandlers } from "./handlers/collab";
import { devtoolsHandlers } from "./handlers/devtools";
import { documentHandlers } from "./handlers/document";
import { fileHandlers } from "./handlers/file";
import { driveHandlers } from "./handlers/drive";
import { insightsHandlers } from "./handlers/insights";
import { workspaceHandlers } from "./handlers/workspace";

/**
 * Backend giả cho test, chặn ở tầng MẠNG.
 *
 * Khác hẳn việc mock module service: ở đây `apiFetch` chạy THẬT — URL, header,
 * `credentials`, bóc envelope lỗi, refresh khi 401 đều được thực thi. Nhờ vậy
 * một sai lệch giữa hình dạng FE mong đợi và hình dạng backend trả về sẽ hiện
 * ra trong test, thay vì chỉ ở môi trường chạy thật.
 */
export const server = setupServer(
  ...workspaceHandlers,
  ...driveHandlers,
  ...documentHandlers,
  ...collabHandlers,
  ...insightsHandlers,
  ...devtoolsHandlers,
  ...boardHandlers,
  ...fileHandlers,
);
