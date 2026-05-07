import os
import arcade
import numpy as np
#import f1_racetelemetry
SCREEN_W = 1920
SCREEN_H = 1200
TITLE_F1 = "F1 Replay"


def create_track_geometry(sample_lap, lane_width=200):
    ref_x = sample_lap["X"].to_numpy()
    ref_y = sample_lap["Y"].to_numpy()

    tx = np.gradient(ref_x)
    ty = np.gradient(ref_y)

    mag = np.sqrt(tx**2 + ty**2)
    mag[mag == 0] = 1.0
    tx /= mag
    ty /= mag

    nx = -ty
    ny = tx

    outer_x = ref_x + nx * (lane_width / 2)
    outer_y = ref_y + ny * (lane_width / 2)
    inner_x = ref_x - nx * (lane_width / 2)
    inner_y = ref_y - ny * (lane_width / 2)

    xmin = min(ref_x.min(), inner_x.min(), outer_x.min())
    xmax = max(ref_x.max(), inner_x.max(), outer_x.max())
    ymin = min(ref_y.min(), inner_y.min(), outer_y.min())
    ymax = max(ref_y.max(), inner_y.max(), outer_y.max())

    return (
        ref_x, ref_y,
        inner_x, inner_y,
        outer_x, outer_y,
        xmin, xmax, ymin, ymax
    )


class ReplayWindow(arcade.Window):
    def __init__(self, frames, lap_example, drivers_ids, title, color_map = None, playback_speed=1.0):

        super().__init__(SCREEN_W, SCREEN_H, title, resizable=True)

        self.telemetry_frames = frames
        self.total_frames = len(frames)
        self.driver_list = list(drivers_ids)
        self.speed_factor = playback_speed
        self.colors = color_map or {}
        self.current_frame = 0
        self.is_paused = False

        (
            self.ref_x_vals, self.ref_y_vals,
            self.in_x_vals, self.in_y_vals,
            self.out_x_vals, self.out_y_vals,
            self.min_x, self.max_x,
            self.min_y, self.max_y
        ) = create_track_geometry(lap_example)

        self.world_inner = self._make_interp(self.in_x_vals, self.in_y_vals)
        self.world_outer = self._make_interp(self.out_x_vals, self.out_y_vals)

        self.screen_inner = []
        self.screen_outer = []

        self.zoom = 1.0
        self.off_x = 0
        self.off_y = 0

        bg_file = os.path.join("resources", "background.png")
        self.bg_img = arcade.load_texture(bg_file) if os.path.exists(bg_file) else None

        arcade.set_background_color(arcade.color.BLACK)

        self._rescale(self.width, self.height)

    def _make_interp(self, xs, ys, count=2000):
        t0 = np.linspace(0, 1, len(xs))
        t1 = np.linspace(0, 1, count)
        xx = np.interp(t1, t0, xs)
        yy = np.interp(t1, t0, ys)
        return list(zip(xx, yy))

    def _world_to_view(self, x, y):
        return (self.zoom * x + self.off_x, self.zoom * y + self.off_y)

    def _rescale(self, w, h):
        margin = 0.05
        w_world = max(1.0, self.max_x - self.min_x)
        h_world = max(1.0, self.max_y - self.min_y)

        usable_w = w * (1 - 2 * margin)
        usable_h = h * (1 - 2 * margin)

        sx = usable_w / w_world
        sy = usable_h / h_world
        self.zoom = min(sx, sy)

        cx_world = (self.min_x + self.max_x) / 2
        cy_world = (self.min_y + self.max_y) / 2

        cx_screen = w / 2
        cy_screen = h / 2

        self.off_x = cx_screen - self.zoom * cx_world
        self.off_y = cy_screen - self.zoom * cy_world

        self.screen_inner = [self._world_to_view(x, y) for x, y in self.world_inner]
        self.screen_outer = [self._world_to_view(x, y) for x, y in self.world_outer]

    def on_resize(self, width, height):
        super().on_resize(width, height)
        self._rescale(width, height)

    def on_draw(self):
        self.clear()

        if self.bg_img:
            arcade.draw_lrbt_rectangle_textured(
                0, self.width, 0, self.height, self.bg_img
            )

        track_rgb = arcade.color.BLACK

        if len(self.screen_inner) > 1:
            arcade.draw_line_strip(self.screen_inner, track_rgb, 4)
        if len(self.screen_outer) > 1:
            arcade.draw_line_strip(self.screen_outer, track_rgb, 4)

        frame = self.telemetry_frames[self.current_frame]
        for code, p in frame["drivers"].items():
            if p.get("rel_dist", 0) == 1:
                continue
            px, py = self._world_to_view(p["x"], p["y"])
            clr = self.colors.get(code, arcade.color.CYBER_YELLOW)
            arcade.draw_circle_filled(px, py, 6, clr)

        lead_code = max(
            frame["drivers"],
            key=lambda d: (
                frame["drivers"][d].get("lap", 1),
                frame["drivers"][d].get("dist", 0)
            )
        )
        lead_lap = frame["drivers"][lead_code].get("lap", 1)

        tt = frame["t"]
        h = int(tt // 3600)
        m = int((tt % 3600) // 60)
        s = int(tt % 60)
        tlabel = f"{h:02}:{m:02}:{s:02}"

        arcade.draw_text(
            f"Lap: {lead_lap}",
            20, self.height - 40,
            arcade.color.WHITE, 24,
            anchor_y="top"
        )
        arcade.draw_text(
            f"Race Time: {tlabel}",
            20, self.height - 80,
            arcade.color.CELESTE, 20,
            anchor_y="top"
        )

        right_x = self.width - 20
        top_y = self.height - 40

        arcade.draw_text(
            "Leaderboard",
            right_x, top_y,
            arcade.color.AQUAMARINE, 20,
            bold=True,
            anchor_x="right",
            anchor_y="top"
        )

        rows = []
        for code, p in frame["drivers"].items():
            rows.append((code, self.colors.get(code, arcade.color.CYBER_YELLOW), p))

        rows.sort(key=lambda r: r[2].get("dist", 999), reverse=True)

        h_step = 25
        for i, (code, color, p) in enumerate(rows):
            pos = i + 1
            label = f"{pos}. {code}   OUT" if p.get("rel_dist", 0) == 1 else f"{pos}. {code}"
            arcade.draw_text(
                label,
                right_x,
                top_y - 30 - (i * h_step),
                color,
                16,
                anchor_x="right",
                anchor_y="top"
            )

        lx = 20
        ly = 150
        legend = [
            "Controls:",
            "[SPACE]  Pause/Resume",
            "[←/→]    Rewind / FastForward",
            "[↑/↓]    Speed +/- (0.5x, 1x, 2x, 4x)"
        ]

        for i, txt in enumerate(legend):
            arcade.draw_text(
                txt,
                lx,
                ly - (i * 25),
                arcade.color.AQUAMARINE if i > 0 else arcade.color.CYBER_YELLOW,
                14,
                bold=(i == 0)
            )

    def on_update(self, dt):
        if self.is_paused:
            return
        step = max(1, int(self.speed_factor))
        self.current_frame += step
        if self.current_frame >= self.total_frames:
            self.current_frame = self.total_frames - 1

    def on_key_press(self, key, mods):
        if key == arcade.key.SPACE:
            self.is_paused = not self.is_paused
        elif key == arcade.key.RIGHT:
            self.current_frame = min(self.current_frame + 10, self.total_frames - 1)
        elif key == arcade.key.LEFT:
            self.current_frame = max(self.current_frame - 10, 0)
        elif key == arcade.key.UP:
            self.speed_factor *= 2.0
        elif key == arcade.key.DOWN:
            self.speed_factor = max(0.1, self.speed_factor / 2.0)
        elif key == arcade.key.KEY_1:
            self.speed_factor = 0.5
        elif key == arcade.key.KEY_2:
            self.speed_factor = 1.0
        elif key == arcade.key.KEY_3:
            self.speed_factor = 2.0
        elif key == arcade.key.KEY_4:
            self.speed_factor = 4.0


def launch_replay( frames, lap_example, drivers_ids, title, color_map, playback_speed=1.0):
    window = ReplayWindow (
        frames=frames,
        lap_example=lap_example,
        drivers_ids=drivers_ids,
        playback_speed=playback_speed,
        color_map=color_map,
        title=title
    )
    arcade.run()
