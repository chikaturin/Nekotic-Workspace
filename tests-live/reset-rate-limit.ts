import { execFileSync } from "node:child_process";

/**
 * Trả lại hạn mức rate limit trước mỗi lần chạy bộ live.
 *
 * `RATE_LIMIT_AUTH` mặc định là 10 lần / 300 giây cho mỗi IP. Một lần chạy suite
 * chỉ tốn vài lần, nhưng chạy lại ba bốn lượt trong năm phút — đúng thứ xảy ra
 * khi đang sửa test — thì lượt sau ăn 429 và cả suite đỏ vì một lý do KHÔNG
 * liên quan gì tới thứ đang test.
 *
 * Cách xử lý là hoàn lại hạn mức, KHÔNG phải nới hạn mức: giới hạn thật vẫn y
 * nguyên trong `.env` của backend, và nó vẫn được test riêng ở phía backend
 * (`test/rate-limit.e2e-spec.ts`). Bộ này chỉ xoá phần budget do chính nó tiêu.
 *
 * Mật khẩu và tiền tố từng được CHÉP TAY vào đây, và cả hai đều là thứ `.env`
 * đổi được: giữa hai lần chạy, project đổi tên `nexdrop` → `nekotic` và hàm này
 * lặng lẽ không xoá được key nào — `catch` trống nuốt sạch, nên nhìn thì như
 * đang chạy tốt. Giờ mật khẩu hỏi thẳng container đang chạy và tiền tố thì
 * không đoán nữa, nên một lần đổi tên nữa cũng không làm nó sai.
 */

const BACKEND = new URL("../../WorkSpace_BE/", import.meta.url).pathname;

const run = (args: readonly string[]): string =>
  execFileSync("docker", [...args], { cwd: BACKEND, stdio: "pipe", encoding: "utf8" });

/**
 * Mật khẩu mà Redis đang thực sự ép, đọc từ chính lệnh khởi động container.
 *
 * KHÔNG đọc `.env`: container còn sống lâu hơn một lần sửa `.env`, và một
 * container khởi động từ bản cũ sẽ vẫn ép mật khẩu cũ. Thứ đang chạy mới là
 * thứ đúng.
 */
/**
 * Container Redis của backend này, tìm bằng NHÃN chứ không bằng tên.
 *
 * Tên container là thứ vừa đổi (`nexdrop-redis` → `nekotic-redis`), nên ghim
 * tên là quay lại đúng con bọ đang sửa. `compose ps` cũng không đủ một mình:
 * sửa `docker-compose.yml` trong lúc container đang chạy là compose không nhận
 * ra chúng nữa, và lệnh trả về rỗng trong khi Redis vẫn sống nhăn.
 */
function redisContainerId(): string | null {
  const fromCompose = (() => {
    try {
      return run(["compose", "ps", "-q", "redis"]).trim();
    } catch {
      return "";
    }
  })();

  if (fromCompose !== "") return fromCompose.split("\n")[0] ?? null;

  try {
    const ids = run([
      "ps",
      "--filter",
      "label=com.docker.compose.service=redis",
      "--format",
      "{{.ID}}",
    ])
      .trim()
      .split("\n")
      .filter((id) => id !== "");

    // Trên máy này có nhiều project cùng chạy Redis. Chỉ lấy cái thuộc backend
    // đang test — nhầm project là xoá key của người khác.
    return (
      ids.find((id) =>
        run([
          "inspect",
          id,
          "--format",
          '{{index .Config.Labels "com.docker.compose.project.working_dir"}}',
        ]).trim() === BACKEND.replace(/\/$/, ""),
      ) ?? null
    );
  } catch {
    return null;
  }
}

function redisPassword(id: string): string | null {
  try {
    const command = JSON.parse(
      run(["inspect", id, "--format", "{{json .Config.Cmd}}"]).trim(),
    ) as readonly string[];

    const flag = command.indexOf("--requirepass");

    return flag >= 0 ? command[flag + 1] ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Xoá mọi key `ratelimit:` — không đụng tới key của BullMQ hay pub/sub.
 *
 * Quét theo `*ratelimit:*` chứ không theo một tiền tố cố định. Trên Redis dev
 * này có ít nhất bốn tiền tố cùng tồn tại (`nexdrop:`, `nexdrop-e2e:`,
 * `probe:`, `nexdrop-probe:`), và ghim đúng một cái là quay lại đúng con bọ vừa
 * sửa.
 *
 * Trả về số key đã xoá, hoặc `null` khi không chạy được. Việc không chạy được
 * là thông tin: nếu suite ăn 429 thì đây là chỗ đầu tiên phải nhìn.
 */
export function resetRateLimit(): number | null {
  const container = redisContainerId();
  const password = container === null ? null : redisPassword(container);

  if (container === null || password === null) {
    console.warn("[live] không tìm được Redis đang chạy — bỏ qua reset rate limit");
    return null;
  }

  try {
    const output = run([
      "exec",
      "-i",
      container,
      "redis-cli",
      "--no-auth-warning",
      "-a",
      password,
      "EVAL",
      `local keys = redis.call('KEYS', ARGV[1])
       for i = 1, #keys do redis.call('DEL', keys[i]) end
       return #keys`,
      "0",
      "*ratelimit:*",
    ]);

    // `redis-cli` báo lỗi AUTH ra stdout với mã thoát 0, nên "không ném" chưa
    // có nghĩa là đã xoá được.
    if (/AUTH failed|NOAUTH|^ERR /im.test(output)) {
      console.warn(`[live] không xoá được rate limit: ${output.trim()}`);
      return null;
    }

    return Number.parseInt(output.trim(), 10) || 0;
  } catch (error: unknown) {
    console.warn(
      `[live] không chạy được resetRateLimit: ${error instanceof Error ? error.message : String(error)}`,
    );

    return null;
  }
}
