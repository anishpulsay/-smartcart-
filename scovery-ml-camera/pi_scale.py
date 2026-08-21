#!/usr/bin/env python3
# =========================================================================
# Scovery SmartCart - Raspberry Pi Load Cell & HX711 Scale Driver
# =========================================================================
# Hardware Wiring (HX711 Module to Raspberry Pi GPIO):
#   VCC -> Pin 1 (3.3V)
#   GND -> Pin 6 (GND)
#   DT  -> GPIO 5 (Pin 29)
#   SCK -> GPIO 6 (Pin 31)
#
# Usage:
#   python3 pi_scale.py               # Run live scale streaming to PC
#   python3 pi_scale.py --calibrate   # Run interactive calibration wizard
#   python3 pi_scale.py --simulate    # Run interactive manual test mode
# =========================================================================

import time
import json
import sys
import argparse
import threading
from pathlib import Path

try:
    import requests
except ImportError:
    print("[ERROR] 'requests' module not found. Run: pip3 install requests")
    sys.exit(1)

# Default PC Server API
PC_SERVER_IP = "Anishs-MacBook-Air.local"  # <-- Mac Hostname
SCALE_API_URL = "http://Anishs-MacBook-Air.local:3001/api/scale"
CONFIG_FILE = Path("scale_config.json")

# Default settings
DEFAULT_CONFIG = {
    "pin_dt": 5,
    "pin_sck": 6,
    "calibration_factor": -105.4,  # Adjust with --calibrate
    "offset": 0.0
}

def load_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                return {**DEFAULT_CONFIG, **cfg}
        except Exception as e:
            print(f"[WARNING] Could not load {CONFIG_FILE}: {e}")
    return DEFAULT_CONFIG.copy()

def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(cfg, f, indent=4)
        print(f"✨ [SUCCESS] Saved scale configuration to {CONFIG_FILE}")
    except Exception as e:
        print(f"[ERROR] Could not save config: {e}")

class UniversalHX711:
    """Universal adapter to support any hx711 Python library version (tatobari/hx711py, PyPI, etc.)"""
    def __init__(self, dout, pd_sck, cal_factor=1.0, offset=0.0):
        from hx711 import HX711
        self.dout = dout
        self.pd_sck = pd_sck
        self.hx = HX711(dout, pd_sck)
        self.is_mock = False
        
        # Reset if available
        if hasattr(self.hx, 'reset'):
            self.hx.reset()
            
        # Apply offset if stored
        if hasattr(self.hx, 'set_offset_value'):
            self.hx.set_offset_value(offset)
        elif hasattr(self.hx, 'set_offset'):
            self.hx.set_offset(offset)
        elif hasattr(self.hx, 'set_offset_A'):
            self.hx.set_offset_A(offset)
        elif hasattr(self.hx, 'OFFSET'):
            self.hx.OFFSET = offset
            
        self.set_cal_factor(cal_factor)
        
    def raw_bitbang_read(self):
        """Direct bit-banged 24-bit read of HX711 to bypass library quirks if library returns 0."""
        try:
            import RPi.GPIO as GPIO
            GPIO.setwarnings(False)
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.pd_sck, GPIO.OUT)
            GPIO.setup(self.dout, GPIO.IN)
            GPIO.output(self.pd_sck, False)
            time.sleep(0.002)

            ready = False
            for _ in range(50):
                if GPIO.input(self.dout) == 0:
                    ready = True
                    break
                time.sleep(0.001)
            if not ready:
                return 0

            val = 0
            for _ in range(24):
                GPIO.output(self.pd_sck, True)
                time.sleep(0.0001)
                val = (val << 1) | GPIO.input(self.dout)
                GPIO.output(self.pd_sck, False)
                time.sleep(0.0001)

            GPIO.output(self.pd_sck, True)
            time.sleep(0.0001)
            GPIO.output(self.pd_sck, False)

            if val & 0x800000:
                val -= 0x1000000
            return val
        except Exception:
            return 0

    def set_cal_factor(self, cal_factor):
        if cal_factor == 0:
            cal_factor = 1.0
        if hasattr(self.hx, 'set_scale_ratio'):
            self.hx.set_scale_ratio(cal_factor)
        elif hasattr(self.hx, 'set_reference_unit_A'):
            self.hx.set_reference_unit_A(cal_factor)
        elif hasattr(self.hx, 'set_reference_unit'):
            self.hx.set_reference_unit(cal_factor)
        if hasattr(self.hx, 'REFERENCE_UNIT'):
            self.hx.REFERENCE_UNIT = cal_factor
        if hasattr(self.hx, 'reference_unit'):
            self.hx.reference_unit = cal_factor

    def zero_tare(self, times=15):
        if hasattr(self.hx, 'zero'):
            self.hx.zero(times)
        elif hasattr(self.hx, 'tare_A'):
            self.hx.tare_A(times)
        elif hasattr(self.hx, 'tare'):
            self.hx.tare(times)
        elif hasattr(self.hx, 'reset'):
            self.hx.reset()
            
    def get_offset(self):
        if hasattr(self.hx, 'get_offset_value'):
            return self.hx.get_offset_value()
        elif hasattr(self.hx, 'get_offset_A'):
            return self.hx.get_offset_A()
        elif hasattr(self.hx, 'get_offset'):
            return self.hx.get_offset()
        elif hasattr(self.hx, 'OFFSET_A'):
            return self.hx.OFFSET_A
        elif hasattr(self.hx, 'OFFSET'):
            return self.hx.OFFSET
        return 0.0

    def get_raw_mean(self, times=15):
        if hasattr(self.hx, 'get_raw_data_mean'):
            val = self.hx.get_raw_data_mean(times)
        elif hasattr(self.hx, 'get_value_A'):
            val = self.hx.get_value_A(times) + self.get_offset()
        elif hasattr(self.hx, 'get_value'):
            val = self.hx.get_value(times) + self.get_offset()
        elif hasattr(self.hx, 'read_average'):
            val = self.hx.read_average(times)
        elif hasattr(self.hx, 'read'):
            val = sum([self.hx.read() for _ in range(times)]) / times
        else:
            val = 0.0
        if val == 0.0 or val == -1 or val == 8388607:
            bb = self.raw_bitbang_read()
            if bb != 0 and bb != -1 and bb != 8388607:
                return float(bb)
        return val

    def get_raw_adc(self):
        """Returns the exact raw 24-bit integer straight from HX711 chip read() without offsets or math"""
        try:
            val = 0
            if hasattr(self.hx, 'read'):
                val = self.hx.read()
            elif hasattr(self.hx, 'read_long'):
                val = self.hx.read_long()
            if val == 0 or val == -1 or val == 8388607:
                val = self.raw_bitbang_read()
            return val
        except Exception:
            return self.raw_bitbang_read()

    def get_weight_val(self, times=5):
        val = 0.0
        if hasattr(self.hx, 'get_weight_A'):
            val = self.hx.get_weight_A(times)
        elif hasattr(self.hx, 'get_weight'):
            val = self.hx.get_weight(times)
        elif hasattr(self.hx, 'get_value'):
            v = self.hx.get_value(times)
            ref = getattr(self.hx, 'REFERENCE_UNIT', getattr(self.hx, 'reference_unit', 1.0))
            val = v / (ref if ref != 0 else 1.0)
        if val == 0.0:
            raw = self.get_raw_adc()
            if raw != 0 and raw != -1 and raw != 8388607:
                offset = self.get_offset()
                ref = getattr(self.hx, 'REFERENCE_UNIT', getattr(self.hx, 'reference_unit', 1.0))
                if ref == 0: ref = 1.0
                val = (raw - offset) / ref
        return val

class MockHX711:
    """Fallback simulator when running without physical hardware."""
    def __init__(self, dout, pd_sck):
        self.simulated_weight = 0.0
        self.offset = 0.0
        self.scale = 1.0
        self.is_mock = True
        print("[INFO] Using simulated/manual scale mode (MockHX711)")

    def zero_tare(self, times=10):
        self.simulated_weight = 0.0

    def get_offset(self):
        return self.offset

    def get_raw_mean(self, times=15):
        return self.simulated_weight * self.scale + self.offset

    def get_raw_adc(self):
        return int(self.simulated_weight * self.scale + self.offset)

    def get_weight_val(self, times=5):
        return self.simulated_weight

    def set_cal_factor(self, ratio):
        self.scale = ratio

def init_hx711(cfg, simulate=False):
    if simulate:
        return MockHX711(cfg["pin_dt"], cfg["pin_sck"])
    try:
        return UniversalHX711(cfg["pin_dt"], cfg["pin_sck"], cal_factor=cfg["calibration_factor"], offset=cfg.get("offset", 0.0))
    except Exception as e:
        print(f"[WARNING] Could not initialize physical HX711 ({e}). Switching to Simulated/Manual Mode...")
        return MockHX711(cfg["pin_dt"], cfg["pin_sck"])

def run_calibration_wizard():
    print("\n=========================================================")
    print("⚖️  Scovery SmartCart - HX711 Load Cell Calibration Wizard")
    print("=========================================================")
    cfg = load_config()
    
    try:
        hx = UniversalHX711(cfg["pin_dt"], cfg["pin_sck"], cal_factor=1.0, offset=0.0)
    except Exception as e:
        print(f"[ERROR] Physical HX711 module not detected ({e}). Ensure hx711 is installed and check wiring.")
        return

    print("\n[Step 1/3] Empty your SmartCart basket completely.")
    input("Press ENTER once the basket is empty to calculate Tare (Zero offset)...")
    print("Zeroing scale (taking 15 samples)...")
    hx.zero_tare(times=15)
    offset = hx.get_offset()
    print(f"✅ Zero/Tare offset calculated: {offset}")

    print("\n[Step 2/3] Place a known weight (e.g., 500g bottle or 100g soap) into the basket.")
    known_str = input("Enter the exact weight in grams of the item placed (e.g. 500): ").strip()
    try:
        known_weight = float(known_str)
        if known_weight <= 0: raise ValueError()
    except ValueError:
        print("[ERROR] Invalid weight entered. Calibration cancelled.")
        return

    print("Measuring raw value (taking 15 samples)...")
    raw_val = hx.get_raw_mean(times=15) - offset
    cal_factor = raw_val / known_weight
    print(f"✅ Calculated Calibration Factor: {cal_factor:.3f}")

    cfg["calibration_factor"] = cal_factor
    cfg["offset"] = offset
    save_config(cfg)
    print("\n🎉 Calibration complete! You can now run `python3 pi_scale.py` to stream weight verification.")

def interactive_simulator_thread(hx):
    """Allows manual weight input via console during simulation mode."""
    print("\n[SIMULATOR CONTROLS] Type commands in console:")
    print("  +100   -> Add 100 grams to basket")
    print("  +500   -> Add 500 grams to basket")
    print("  -100   -> Remove 100 grams from basket")
    print("  t / r  -> Tare / reset scale to 0 grams")
    print("  150    -> Set exact weight to 150 grams\n")
    while True:
        try:
            cmd = input().strip().lower()
            if not cmd: continue
            if cmd in ['t', 'r', 'tare', 'reset']:
                hx.zero_tare()
                print("[SCALE TARED] Current Weight = 0.0g")
            elif cmd.startswith('+'):
                delta = float(cmd[1:])
                hx.simulated_weight = round(hx.simulated_weight + delta, 1)
                print(f"[ITEM ADDED +{delta}g] Current Basket Weight = {hx.simulated_weight}g")
            elif cmd.startswith('-'):
                delta = float(cmd[1:])
                hx.simulated_weight = round(max(0.0, hx.simulated_weight - delta), 1)
                print(f"[ITEM REMOVED -{delta}g] Current Basket Weight = {hx.simulated_weight}g")
            else:
                val = float(cmd)
                hx.simulated_weight = round(val, 1)
                print(f"[EXACT WEIGHT SET] Current Basket Weight = {hx.simulated_weight}g")
        except Exception:
            print("[INVALID COMMAND] Try: +100, -50, t, or exact number like 250")

def main():
    parser = argparse.ArgumentParser(description="Scovery SmartCart Load Cell & Scale Driver")
    parser.add_argument("--calibrate", action="store_true", help="Run interactive calibration wizard")
    parser.add_argument("--simulate", action="store_true", help="Run in simulated/interactive manual mode")
    parser.add_argument("--monitor", action="store_true", help="Print live weight monitor directly to terminal console")
    args = parser.parse_args()

    if args.calibrate:
        run_calibration_wizard()
        return

    cfg = load_config()
    hx = init_hx711(cfg, simulate=args.simulate)

    print("=========================================================")
    print(f"🚀 SmartCart Load Cell Service Running (`{PC_SERVER_IP}`)")
    print(f"📌 Using GPIO Pins: DT = GPIO {cfg['pin_dt']}, SCK = GPIO {cfg['pin_sck']}")
    if not CONFIG_FILE.exists() and not args.simulate:
        print("⚠️  scale_config.json not found on Pi! Using default pins DT=5, SCK=6.")
        print("💡 If your wires are on different pins, run 'npm.cmd run scale:doctor' to auto-detect them!")
    print("=========================================================")

    if getattr(hx, 'is_mock', False):
        sim_thread = threading.Thread(target=interactive_simulator_thread, args=(hx,), daemon=True)
        sim_thread.start()

    last_sent_weight = None
    last_print_time = 0
    last_send_time = 0

    try:
        while True:
            try:
                raw_weight = hx.get_weight_val(times=3 if not getattr(hx, 'is_mock', False) else 1)
                current_weight = round(raw_weight, 1)

                now = time.time()
                delta = round(current_weight - (last_sent_weight if last_sent_weight is not None else 0.0), 1)

                # Print live monitor to console whenever weight changes or every 1.5s
                if args.monitor or last_sent_weight is None or abs(current_weight - (last_sent_weight or 0)) >= 1.0 or (now - last_print_time) > 1.5:
                    raw_adc = hx.get_raw_adc() if hasattr(hx, 'get_raw_adc') else 0
                    delta_str = f"{delta:+g}g" if last_sent_weight is not None else "0g"
                    raw_str = f"ADC: {raw_adc:>8d}" if not getattr(hx, 'is_mock', False) else "Mock Mode"
                    print(f"⚖️  [LIVE SCALE MONITOR] Weight: {current_weight:>7.1f} g  |  Delta: {delta_str:>7s}  |  {raw_str}  |  Status: {'Simulated Mode' if getattr(hx, 'is_mock', False) else 'Physical Scale Active'}")
                    last_print_time = now

                if last_sent_weight is None or abs(current_weight - last_sent_weight) >= 5.0 or (now - last_send_time) > 1.5:
                    payload = {
                        "current_weight": current_weight,
                        "delta": delta,
                        "is_stable": True,
                        "timestamp": now
                    }
                    try:
                        requests.post(SCALE_API_URL, json=payload, timeout=1.0)
                        last_sent_weight = current_weight
                        last_send_time = now
                    except Exception as e:
                        if getattr(hx, 'is_mock', False) and (now - last_send_time) > 5.0:
                            print(f"[WARNING] Could not forward weight to {SCALE_API_URL}: {e}")

                time.sleep(0.2 if not getattr(hx, 'is_mock', False) else 0.4)

            except Exception as e:
                print(f"[ERROR] Scale reading error: {e}")
                time.sleep(1.0)

    except KeyboardInterrupt:
        print("\n[INFO] Stopping Load Cell Service.")

if __name__ == "__main__":
    main()
