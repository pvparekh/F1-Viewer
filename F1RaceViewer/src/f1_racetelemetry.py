import os
import fastf1
import fastf1.plotting
import numpy as np
import json

fastf1.Cache.enable_cache('.fastf1-cache')
fps = 25
DT = 1 / fps

def extract_race_telemetry(session):
    event_id = str(session).replace(' ', '_')
    try:
        if "--refresh-data" not in os.sys.argv:
            with open(f"computed_data/{event_id}_race_telemetry.json", "r") as fh:
                frames = json.load(fh)
                print("Loaded precomputed race telemetry data.")
                print("The replay should begin in a new window shortly!")
                return frames
    except FileNotFoundError:
        pass

    driver_ids = session.drivers
    code_map = {num: session.get_driver(num)["Abbreviation"] for num in driver_ids}
    collected = {}
    t_global_min = None
    t_global_max = None

    for drv in driver_ids:
        abbr = code_map[drv]
        print("Getting telemetry for driver:", abbr)
        laps_for_driver = session.laps.pick_drivers(drv)
        if laps_for_driver.empty:
            continue

        times_list = []
        xs_list = []
        ys_list = []
        race_dist_list = []
        rel_dist_list = []
        lapnum_list = []
        cumulative_dist = 0.0

        for _, lap in laps_for_driver.iterlaps():
            lap_tel = lap.get_telemetry()
            lap_no = lap.LapNumber
            if lap_tel.empty:
                continue

            t_lap = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
            x_lap = lap_tel["X"].to_numpy()
            y_lap = lap_tel["Y"].to_numpy()
            d_lap = lap_tel["Distance"].to_numpy()
            rd_lap = lap_tel["RelativeDistance"].to_numpy()

            d_lap = d_lap - d_lap.min()
            lap_len = d_lap.max()
            race_d_lap = cumulative_dist + d_lap
            cumulative_dist += lap_len

            times_list.append(t_lap)
            xs_list.append(x_lap)
            ys_list.append(y_lap)
            race_dist_list.append(race_d_lap)
            rel_dist_list.append(rd_lap)
            lapnum_list.append(np.full_like(t_lap, lap_no))

        if not times_list:
            continue

        t_all = np.concatenate(times_list)
        x_all = np.concatenate(xs_list)
        y_all = np.concatenate(ys_list)
        race_dist_all = np.concatenate(race_dist_list)
        rel_dist_all = np.concatenate(rel_dist_list)
        lap_numbers = np.concatenate(lapnum_list)

        order = np.argsort(t_all)
        t_all = t_all[order]
        x_all = x_all[order]
        y_all = y_all[order]
        race_dist_all = race_dist_all[order]
        rel_dist_all = rel_dist_all[order]
        lap_numbers = lap_numbers[order]

        collected[abbr] = {
            "t": t_all,
            "x": x_all,
            "y": y_all,
            "dist": race_dist_all,
            "rel_dist": rel_dist_all,
            "lap": lap_numbers,
        }

        t_min = t_all.min()
        t_max = t_all.max()
        t_global_min = t_min if t_global_min is None else min(t_global_min, t_min)
        t_global_max = t_max if t_global_max is None else max(t_global_max, t_max)

    timeline = np.arange(t_global_min, t_global_max, DT) - t_global_min
    resampled = {}

    for abbr, data in collected.items():
        t_shifted = data["t"] - t_global_min
        order = np.argsort(t_shifted)
        t_sorted = t_shifted[order]
        x_sorted = data["x"][order]
        y_sorted = data["y"][order]
        dist_sorted = data["dist"][order]
        rel_dist_sorted = data["rel_dist"][order]
        lap_sorted = data["lap"][order]

        x_rs = np.interp(timeline, t_sorted, x_sorted)
        y_rs = np.interp(timeline, t_sorted, y_sorted)
        dist_rs = np.interp(timeline, t_sorted, dist_sorted)
        rel_dist_rs = np.interp(timeline, t_sorted, rel_dist_sorted)
        lap_rs = np.interp(timeline, t_sorted, lap_sorted)

        resampled[abbr] = {
            "t": timeline,
            "x": x_rs,
            "y": y_rs,
            "dist": dist_rs,
            "rel_dist": rel_dist_rs,
            "lap": lap_rs,
        }

    frames = []
    for i, t in enumerate(timeline):
        snapshot = []
        for abbr, d in resampled.items():
            snapshot.append({
                "code": abbr,
                "dist": float(d["dist"][i]),
                "x": float(d["x"][i]),
                "y": float(d["y"][i]),
                "lap": int(round(d["lap"][i])),
                "rel_dist": float(d["rel_dist"][i]),
            })

        if not snapshot:
            continue

        snapshot.sort(key=lambda r: r["dist"], reverse=True)
        leader = snapshot[0]
        leader_lap = leader["lap"]

        frame_drivers = {}
        for idx, car in enumerate(snapshot):
            code = car["code"]
            frame_drivers[code] = {
                "x": car["x"],
                "y": car["y"],
                "dist": car["dist"],
                "lap": car["lap"],
                "rel_dist": round(car["rel_dist"], 6),
                "position": idx + 1,
            }

        frames.append({
            "t": float(t),
            "lap": leader_lap,
            "drivers": frame_drivers,
        })

    print("completed telemetry extraction...")
    print("Saving to JSON file...")

    if not os.path.exists("computed_data"):
        os.makedirs("computed_data")

    with open(f"computed_data/{event_id}_race_telemetry.json", "w") as out_f:
        json.dump(frames, out_f, indent=2)

    print("Saved!")
    print("The replay will start in a new window")
    return frames


def map_driver_colors(session):
    mapping = fastf1.plotting.get_driver_color_mapping(session)
    rgb_map = {}
    for drv, hex_color in mapping.items():
        hex_clean = hex_color.lstrip('#')
        rgb = tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))
        rgb_map[drv] = rgb
    return rgb_map


def open_race_session(year, round_number):
    sess = fastf1.get_session(year, round_number, 'R')
    sess.load(telemetry=True)
    return sess
