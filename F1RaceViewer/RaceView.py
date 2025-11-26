from src.f1_racetelemetry import extract_race_telemetry, map_driver_colors, open_race_session
from src.f1_replay import launch_replay
import sys


def map_driver_numbers(sess):
    """Return mapping of driver number -> abbreviation."""
    return {
        num: sess.get_driver(num)["Abbreviation"]
        for num in sess.drivers
    }


def parse_cli_args():
    if "--year" in sys.argv:
        yi = sys.argv.index("--year") + 1
        year_val = int(sys.argv[yi])
    else:
        year_val = 2025

    if "--round" in sys.argv:
        ri = sys.argv.index("--round") + 1
        round_val = int(sys.argv[ri])
    else:
        round_val = 12

    return year_val, round_val


def main(year=None, round_number=None, playback_speed=1):
    sess = open_race_session(year, round_number)  # session data
    print(f"Loaded session: {sess.event['EventName']} - {sess.event['RoundNumber']}")
    
    race_data = extract_race_telemetry(sess)
    ref_lap = sess.laps.pick_fastest().get_telemetry()
    driver_map = map_driver_numbers(sess)
    colors = map_driver_colors(sess)

    launch_replay(
        frames=race_data,
        lap_example=ref_lap,
        drivers_ids=sess.drivers,
        playback_speed=playback_speed,
        color_map=colors,
        title=f"{sess.event['EventName']} - Race"
    )


if __name__ == "__main__":
    year_arg, round_arg = parse_cli_args()
    main(year_arg, round_arg, playback_speed=1)
