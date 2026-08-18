#!/usr/bin/env python3
# =========================================================================
# Scovery SmartCart - Raspberry Pi HX711 Load Cell Hardware Doctor
# =========================================================================
# Automatically scans GPIO and BOARD pins to detect where the physical
# HX711 load cell wires (DT and SCK) are connected, verifies raw pulses,
# and updates scale_config.json automatically.
# =========================================================================

import time
import json
import sys
from pathlib import Path

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("[ERROR] RPi.GPIO module not found. Run: pip3 install RPi.GPIO")
    sys.exit(1)

try:
    from hx711 import HX711
except ImportError:
    print("[ERROR] hx711 module not found. Run: pip3 install hx711")
    sys.exit(1)

CONFIG_FILE = Path("scale_config.json")

# Physical pin mapping lookup for user clarity
BCM_TO_PHYSICAL = {
    2: 3, 3: 5, 4: 7, 14: 8, 15: 10, 17: 11, 18: 12, 27: 13,
    22: 15, 23: 16, 24: 18, 10: 19, 9: 21, 25: 22, 11: 23, 8: 24,
    7: 26, 0: 27, 1: 28, 5: 29, 6: 31, 12: 32, 13: 33, 19: 35,
    16: 36, 26: 37, 20: 38, 21: 40
}

ALL_GPIOS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]

def raw_bitbang_read(dt_bcm, sck_bcm):
    """Direct bit-banged 24-bit read of HX711 to bypass library quirks during scanning."""
    try:
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(sck_bcm, GPIO.OUT)
        GPIO.setup(dt_bcm, GPIO.IN)
        GPIO.output(sck_bcm, False)
        time.sleep(0.002)

        # Check if ready (DT goes LOW when data ready)
        ready = False
        for _ in range(50):
            if GPIO.input(dt_bcm) == 0:
                ready = True
                break
            time.sleep(0.001)
        if not ready:
            GPIO.cleanup([dt_bcm, sck_bcm])
            return 0

        val = 0
        for _ in range(24):
            GPIO.output(sck_bcm, True)
            time.sleep(0.0001)
            val = (val << 1) | GPIO.input(dt_bcm)
            GPIO.output(sck_bcm, False)
            time.sleep(0.0001)

        # 25th pulse for Gain 128
        GPIO.output(sck_bcm, True)
        time.sleep(0.0001)
        GPIO.output(sck_bcm, False)

        GPIO.cleanup([dt_bcm, sck_bcm])
        
        # Convert 24-bit two's complement
        if val & 0x800000:
            val -= 0x1000000
        return val
    except Exception:
        try:
            GPIO.cleanup([dt_bcm, sck_bcm])
        except Exception:
            pass
        return 0

def test_pin_pair(dt_bcm, sck_bcm, label=""):
    try:
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        
        # Check initial state of DT
        GPIO.setup(dt_bcm, GPIO.IN)
        initial_dt = GPIO.input(dt_bcm)
        GPIO.cleanup([dt_bcm])
        
        # Try library read first
        hx = HX711(dt_bcm, sck_bcm)
        samples = []
        for _ in range(2):
            val = 0
            if hasattr(hx, 'read'):
                val = hx.read()
            elif hasattr(hx, 'read_long'):
                val = hx.read_long()
            elif hasattr(hx, 'get_raw_data_mean'):
                val = int(hx.get_raw_data_mean(1))
            if val != 0 and val != -1 and val != 8388607:
                samples.append(val)
            time.sleep(0.02)
            
        GPIO.cleanup([dt_bcm, sck_bcm])
        
        if len(samples) > 0:
            avg_raw = sum(samples) // len(samples)
            return True, avg_raw, initial_dt
            
        # Try direct bitbang read
        bb_val = raw_bitbang_read(dt_bcm, sck_bcm)
        if bb_val != 0 and bb_val != -1 and bb_val != 8388607 and bb_val != -8388608:
            return True, bb_val, initial_dt

        return False, 0, initial_dt
    except Exception as e:
        try:
            GPIO.cleanup([dt_bcm, sck_bcm])
        except Exception:
            pass
        return False, 0, 0

def main():
    print("=========================================================")
    print("🩺  Scovery SmartCart - HX711 Hardware Doctor & Scanner")
    print("=========================================================")
    print("[INFO] Checking physical pin states and scanning for active HX711 hardware...\n")

    # Step 1: Check Default Config
    dt_cfg = 5
    sck_cfg = 6
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                dt_cfg = cfg.get("pin_dt", 5)
                sck_cfg = cfg.get("pin_sck", 6)
        except Exception:
            pass

    print(f"-> Testing currently configured pins: DT = GPIO {dt_cfg} (Pin {BCM_TO_PHYSICAL.get(dt_cfg, '?')}), SCK = GPIO {sck_cfg} (Pin {BCM_TO_PHYSICAL.get(sck_cfg, '?')})")
    success, raw_val, dt_state = test_pin_pair(dt_cfg, sck_cfg, "Configured")
    
    if success:
        print(f"✅  SUCCESS! Active HX711 signal detected on configured pins!")
        print(f"    Raw ADC Hardware Pulses: {raw_val}")
        print("\n🎉 Your wiring is good! To see live weight changes, run:")
        print("    npm.cmd run scale:monitor")
        input("\n[INFO] Press ENTER to close diagnostic report...")
        return

    print(f"❌  No valid pulses on configured pins (DT logic state: {'HIGH (1)' if dt_state else 'LOW (0)'}).")
    print("\n🔍  Starting exhaustive scan across ALL 40 PINS (650 GPIO combinations)...")

    found = False
    checked = 0
    total_pairs = len(ALL_GPIOS) * (len(ALL_GPIOS) - 1)

    for dt in ALL_GPIOS:
        if found: break
        for sck in ALL_GPIOS:
            if dt == sck: continue
            checked += 1
            if checked % 50 == 0 or checked == 1:
                print(f"   Scanning combination {checked}/{total_pairs} (Testing DT=GPIO {dt}/Pin {BCM_TO_PHYSICAL.get(dt, '?')}, SCK=GPIO {sck}/Pin {BCM_TO_PHYSICAL.get(sck, '?')})...")
                sys.stdout.flush()

            ok, val, _ = test_pin_pair(dt, sck)
            if ok:
                print(f"\n🎉 FOUND YOUR HX711 MODULE! Active signal detected!")
                print(f"    -> Data Pin (DT):  GPIO {dt}  (Physical Header Pin {BCM_TO_PHYSICAL.get(dt, '?')})")
                print(f"    -> Clock Pin (SCK): GPIO {sck} (Physical Header Pin {BCM_TO_PHYSICAL.get(sck, '?')})")
                print(f"    -> Raw Hardware ADC Pulses: {val}")
                found = True
                
                # Update scale_config.json automatically
                cfg_data = {}
                if CONFIG_FILE.exists():
                    try:
                        with open(CONFIG_FILE, "r") as f:
                            cfg_data = json.load(f)
                    except Exception:
                        pass
                cfg_data["pin_dt"] = dt
                cfg_data["pin_sck"] = sck
                with open(CONFIG_FILE, "w") as f:
                    json.dump(cfg_data, f, indent=4)
                
                print(f"\n✅ Automatically updated `scale_config.json`! Both `npm.cmd run scale:monitor` and `npm.cmd run scale:calibrate` will now work perfectly right out of the box!")
                break

    if not found:
        print("\n=========================================================================")
        print("⚠️  DIAGNOSTIC RESULT: No active HX711 pulses on ANY of the 40 GPIO pins!")
        print("=========================================================================")
        print("We just tested every single pin on your Raspberry Pi header and not a single pin")
        print("is receiving data pulses from your HX711 load cell board.")
        print("\nPlease check these 3 physical connections right now:")
        print("  1. HX711 Power Wire (VCC): Make sure it is securely plugged into Physical Pin 1 (3.3V) or Physical Pin 2 (5V). If VCC is loose or disconnected, the chip has zero power.")
        print("  2. HX711 Ground Wire (GND): Make sure it is securely plugged into Physical Pin 6 (GND).")
        print("  3. Load Cell Wires to HX711 Board: Check that the 4 colored wires coming from the aluminum scale bar (Red, Black, White, Green) are screwed down tightly into E+, E-, A-, and A+ terminal block on the HX711 green board.")
        print("\nOnce you push the wires firmly into place, re-run: `npm.cmd run scale:doctor`")

    input("\n[INFO] Press ENTER to close diagnostic report...")

if __name__ == "__main__":
    main()
