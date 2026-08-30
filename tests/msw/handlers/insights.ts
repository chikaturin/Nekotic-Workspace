import { http, HttpResponse } from "msw";
import { MOCK_NOW } from "@/config/app";
import { API_BASE_URL } from "@/config/api";
import { CURRENT_USER } from "@/mock/users";
import { dashboardFake } from "../fake/dashboard.fake";
import { myWorkFake } from "../fake/my-work.fake";
import { searchFake } from "../fake/search.fake";

const url = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Context `insights`.
 *
 * Ba endpoint này đều CHẤM ĐIỂM hoặc TỔNG HỢP trên toàn workspace, và cả ba đều
 * lọc theo quyền của phiên đang gọi. Handler ở đây không kiểm quyền — chuyện đó
 * thuộc về e2e của backend, nơi có bảng `access_rules` thật; ở đây điều đáng
 * kiểm là FE gửi đúng tham số và đọc đúng hình dạng trả về.
 */
export const insightsHandlers = [
  http.get(url("/workspaces/:workspaceId/search"), async ({ request }) => {
    const query = new URL(request.url).searchParams.get("q") ?? "";

    return HttpResponse.json(
      await searchFake.search({ query, role: "admin", user: CURRENT_USER }),
    );
  }),

  http.get(url("/workspaces/:workspaceId/dashboard"), async () =>
    HttpResponse.json(await dashboardFake.load({ nowIso: MOCK_NOW })),
  ),

  http.get(url("/me/work"), async () =>
    HttpResponse.json(
      await myWorkFake.load({ userId: CURRENT_USER.id, nowIso: MOCK_NOW }),
    ),
  ),
];
