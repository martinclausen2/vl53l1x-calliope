//This extension can be used for the education field and hobbies.
//Most of the functionality of this extension is based on the VL53L1X 
//library for Arduino provided by pololu, and the register adress names 
//and variable names are quoted from the library.

/**
* VL53L1X block
*/
//% weight=90 color=#1eb0f0 icon="\uf0b2"
namespace VL53L1X {
    type ResultBuffer = {
        range_status: number
        stream_count: number
        dss_actual_effective_spads_sd0: number
        ambient_count_rate_mcps_sd0: number
        final_crosstalk_corrected_range_mm_sd0: number
        peak_signal_count_rate_crosstalk_corrected_mcps_sd0: number
    }
	
    enum RangeStatus {
        RangeValid = 0,
        SigmaFail = 1,
        SignalFail = 2,
        RangeValidMinRangeClipped = 3,
        OutOfBoundsFail = 4,
        HardwareFail = 5,
        RangeValidNoWrapCheckFail = 6,
        WrapTargetFail = 7,
        XtalkSignalFail = 9,
        SynchronizationInt = 10,
        MinRangeFail = 13,
        None = 255,
    }
	
	export enum  DistanceMode {
		Short, Medium, Long,
	}

    type RangingData = {
        range_mm?: number
        range_status?: RangeStatus
        peak_signal_count_rate_MCPS?: number
        ambient_count_rate_MCPS?: number
    }
    const SOFT_RESET = 0x0000
    const OSC_MEASURED__FAST_OSC__FREQUENCY = 0x0006
    const VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND = 0x0008
    const VHV_CONFIG__INIT = 0x000B
    const ALGO__PART_TO_PART_RANGE_OFFSET_MM = 0x001E
    const MM_CONFIG__OUTER_OFFSET_MM = 0x0022
    const DSS_CONFIG__TARGET_TOTAL_RATE_MCPS = 0x0024
    const PAD_I2C_HV__EXTSUP_CONFIG = 0x002E
    const GPIO__TIO_HV_STATUS = 0x0031
    const SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS = 0x0036
    const SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS = 0x0037
    const ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM = 0x0039
    const ALGO__RANGE_IGNORE_VALID_HEIGHT_MM = 0x003E
    const ALGO__RANGE_MIN_CLIP = 0x003F
    const ALGO__CONSISTENCY_CHECK__TOLERANCE = 0x0040
    const CAL_CONFIG__VCSEL_START = 0x0047
    const PHASECAL_CONFIG__TIMEOUT_MACROP = 0x004B
    const PHASECAL_CONFIG__OVERRIDE = 0x004D
    const DSS_CONFIG__ROI_MODE_CONTROL = 0x004F
    const SYSTEM__THRESH_RATE_HIGH = 0x0050
    const SYSTEM__THRESH_RATE_LOW = 0x0052
    const DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT = 0x0054
    const DSS_CONFIG__APERTURE_ATTENUATION = 0x0057
    const MM_CONFIG__TIMEOUT_MACROP_A = 0x005A
    const MM_CONFIG__TIMEOUT_MACROP_B = 0x005C
    const RANGE_CONFIG__TIMEOUT_MACROP_A = 0x005E
    const RANGE_CONFIG__VCSEL_PERIOD_A = 0x0060
    const RANGE_CONFIG__TIMEOUT_MACROP_B = 0x0061
    const RANGE_CONFIG__VCSEL_PERIOD_B = 0x0063
    const RANGE_CONFIG__SIGMA_THRESH = 0x0064
    const RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS = 0x0066
    const RANGE_CONFIG__VALID_PHASE_HIGH = 0x0069
    const SYSTEM__GROUPED_PARAMETER_HOLD_0 = 0x0071
    const SYSTEM__SEED_CONFIG = 0x0077
    const SD_CONFIG__WOI_SD0 = 0x0078
    const SD_CONFIG__WOI_SD1 = 0x0079
    const SD_CONFIG__INITIAL_PHASE_SD0 = 0x007A
    const SD_CONFIG__INITIAL_PHASE_SD1 = 0x007B
    const SYSTEM__GROUPED_PARAMETER_HOLD_1 = 0x007C
    const SD_CONFIG__QUANTIFIER = 0x007E
    const SYSTEM__SEQUENCE_CONFIG = 0x0081
    const SYSTEM__GROUPED_PARAMETER_HOLD = 0x0082
    const SYSTEM__INTERRUPT_CLEAR = 0x0086
    const SYSTEM__MODE_START = 0x0087
    const RESULT__RANGE_STATUS = 0x0089
    const PHASECAL_RESULT__VCSEL_START = 0x00D8
    const RESULT__OSC_CALIBRATE_VAL = 0x00DE
    const FIRMWARE__SYSTEM_STATUS = 0x00E5
    const TargetRate = 0x0A00
    const TimingGuard = 4528
    const i2cAddr = 0x29
    const io_timeout = 500

    let calibrated: boolean = false
    let fast_osc_frequency = 1
    let saved_vhv_init = 0
    let saved_vhv_timeout = 0
    let results: ResultBuffer = {
        range_status:0,
        stream_count:0,
        dss_actual_effective_spads_sd0:0,
        ambient_count_rate_mcps_sd0:0,
        final_crosstalk_corrected_range_mm_sd0:0,
        peak_signal_count_rate_crosstalk_corrected_mcps_sd0:0
    }
    let ranging_data: RangingData = {}
    let osc_calibrate_val = 0
    let timeout_start_ms = 0

    /**
     * VL53L1X Initialize
     */
    //% blockId="VL53L1X_INITIALIZE" block="init vl53l1x"
    export function init(): void {
        writeReg(SOFT_RESET, 0x00)
        basic.pause(1)
        writeReg(SOFT_RESET, 0x01)
        basic.pause(1)
        startTimeout()
        while ((readReg(FIRMWARE__SYSTEM_STATUS) & 0x01) == 0) {
            if (checkTimeoutExpired()) {
                return
            }
        }
        writeReg(PAD_I2C_HV__EXTSUP_CONFIG,
            readReg(PAD_I2C_HV__EXTSUP_CONFIG) | 0x01)
        fast_osc_frequency = readReg16Bit(OSC_MEASURED__FAST_OSC__FREQUENCY)
        osc_calibrate_val = readReg16Bit(RESULT__OSC_CALIBRATE_VAL)
        writeReg16Bit(DSS_CONFIG__TARGET_TOTAL_RATE_MCPS, TargetRate)
        writeReg(GPIO__TIO_HV_STATUS, 0x02)
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS, 8)
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS, 16)
        writeReg(ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM, 0x01)
        writeReg(ALGO__RANGE_IGNORE_VALID_HEIGHT_MM, 0xFF)
        writeReg(ALGO__RANGE_MIN_CLIP, 0)
        writeReg(ALGO__CONSISTENCY_CHECK__TOLERANCE, 2)

        writeReg16Bit(SYSTEM__THRESH_RATE_HIGH, 0x0000)
        writeReg16Bit(SYSTEM__THRESH_RATE_LOW, 0x0000)
        writeReg(DSS_CONFIG__APERTURE_ATTENUATION, 0x38)

        writeReg16Bit(RANGE_CONFIG__SIGMA_THRESH, 360)
        writeReg16Bit(RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS, 192)

        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_0, 0x01)
        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_1, 0x01)
        writeReg(SD_CONFIG__QUANTIFIER, 2)

        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD, 0x00)
        writeReg(SYSTEM__SEED_CONFIG, 1)
        writeReg(SYSTEM__SEQUENCE_CONFIG, 0x8B)
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 200 << 8)
        writeReg(DSS_CONFIG__ROI_MODE_CONTROL, 2)
        setDistanceMode(DistanceMode.Long)
        setMeasurementTimingBudget(50000)
        writeReg16Bit(ALGO__PART_TO_PART_RANGE_OFFSET_MM,
            readReg16Bit(MM_CONFIG__OUTER_OFFSET_MM) * 4)
    }

    /**
     * Set distance mode of the sensor to Short, Medium, or Long
	 * More details: 
	 * STM Datasheet
	 * https://wolles-elektronikkiste.de/vl53l0x-und-vl53l1x-tof-abstandssensoren
	 */
    //% blockId="VL53L1X_SET_DISTANCE_MODE" block="set distance mode %mode"
	export function setDistanceMode(mode: DistanceMode): void {
		switch (mode)
			{
            case DistanceMode.Short:
			  // from VL53L1_preset_mode_standard_ranging_short_range()

			  // timing config
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x07);
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x05);
			  writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0x38);

			  // dynamic config
			  writeReg(SD_CONFIG__WOI_SD0, 0x07);
			  writeReg(SD_CONFIG__WOI_SD1, 0x05);
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 6); // tuning parm default
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 6); // tuning parm default

			  break;

            case DistanceMode.Medium:
			  // from VL53L1_preset_mode_standard_ranging()

			  // timing config
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x0B);
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x09);
			  writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0x78);

			  // dynamic config
			  writeReg(SD_CONFIG__WOI_SD0, 0x0B);
			  writeReg(SD_CONFIG__WOI_SD1, 0x09);
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 10); // tuning parm default
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 10); // tuning parm default

			  break;

            case DistanceMode.Long: // long
			  // from VL53L1_preset_mode_standard_ranging_long_range()

			  // timing config
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x0F);
			  writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x0D);
			  writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0xB8);

			  // dynamic config
			  writeReg(SD_CONFIG__WOI_SD0, 0x0F);
			  writeReg(SD_CONFIG__WOI_SD1, 0x0D);
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 14); // tuning parm default
			  writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 14); // tuning parm default

			  break;

			default:
			  // unrecognized mode - do nothing
			}

		// reapply timing budget
		setMeasurementTimingBudget(50000);
	}

    /**
     * Set maximum time permitted for the sensor to return a distance value
	 * 20 ms is the minimum timing budget and can be used only in Short distance mode.
	 * 33 ms is the minimum timing budget which can work for all distance modes.
	 * 140 ms is the timing budget which allows the maximum distance to be reached under Long distance mode
	 * 1000ms is the maximum value
     */
    //% blockId="VL53L1X_SET_TIMING_BUDGET" block="set timing budget %budget_us"
	//% budget_us.min=20000 budget_us.max=1000000 v.defl=50000
    export function setMeasurementTimingBudget(budget_us: number): void {
        if (budget_us <= TimingGuard) { return }
        budget_us -= TimingGuard
        let range_config_timeout_us = budget_us
        if (range_config_timeout_us > 1100000) { return }
        range_config_timeout_us = Math.floor(range_config_timeout_us/2)
        let macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_A))
        let phasecal_timeout_mclks = timeoutMicrosecondsToMclks(1000, macro_period_us)
        if (phasecal_timeout_mclks > 0xFF) { phasecal_timeout_mclks = 0xFF }
        writeReg(PHASECAL_CONFIG__TIMEOUT_MACROP, phasecal_timeout_mclks)
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)))
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
        macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_B))
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)))
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
    }

    function read(): number {
        startTimeout()
        while (!dataReady()) {
            if (checkTimeoutExpired()) {
                return 0
            }
        }
        readResults()
        if (!calibrated) {
            setupManualCalibration()
            calibrated = true
        }
        updateDSS()
        let range = results.final_crosstalk_corrected_range_mm_sd0
        ranging_data.range_mm = Math.floor((range * 2011 + 0x0400) / 0x0800)
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01)
        if (results.range_status == 4) ranging_data.range_mm = 9999
        return ranging_data.range_mm
    }

    /**
     * Read Distance as number in units of milimeter
     */
    //% blockId="NUMBER_DISTANCE" block="distance"
    export function readSingle(): number {
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01)
        writeReg(SYSTEM__MODE_START, 0x10)
        return read()
    }

    /**
     * Read Distance as formated string including units
     */
    //% blockId="STRING_DISTANCE" block="s_distance"
    export function stringDistance(): string {
        let d = readSingle()
        let d1 = Math.floor(d / 10)
        let d2 = Math.floor(d - (d1 * 10))
        let s = `${d1}` + '.' + `${d2}` + " cm "
        return s
    }
    
    function setupManualCalibration(): void {
        saved_vhv_init = readReg(VHV_CONFIG__INIT)
        saved_vhv_timeout = readReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND)
        writeReg(VHV_CONFIG__INIT, saved_vhv_init & 0x7F)
        writeReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND,
            (saved_vhv_timeout & 0x03) + (3 << 2))
        writeReg(PHASECAL_CONFIG__OVERRIDE, 0x01)
        writeReg(CAL_CONFIG__VCSEL_START, readReg(PHASECAL_RESULT__VCSEL_START))
    }

    function readResults(): void {
        pins.i2cWriteNumber(i2cAddr, RESULT__RANGE_STATUS, NumberFormat.UInt16BE, false)
        let buf = pins.i2cReadBuffer(i2cAddr, 17, false)
        results.range_status = buf.getNumber(NumberFormat.UInt8BE, 0)
        results.stream_count = buf.getNumber(NumberFormat.UInt8BE, 2)
        results.dss_actual_effective_spads_sd0 = buf.getNumber(NumberFormat.UInt16BE, 3)
        results.ambient_count_rate_mcps_sd0 = buf.getNumber(NumberFormat.UInt16BE, 7)
        results.final_crosstalk_corrected_range_mm_sd0 = buf.getNumber(NumberFormat.UInt16BE, 13)
        results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 = buf.getNumber(NumberFormat.UInt16BE, 15)
    }

    function updateDSS(): void {
        let spadCount = results.dss_actual_effective_spads_sd0
        if (spadCount != 0) {
            let totalRatePerSpad =
                results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 +
                results.ambient_count_rate_mcps_sd0
            if (totalRatePerSpad > 0xFFFF) { totalRatePerSpad = 0xFFFF }
            totalRatePerSpad <<= 16
            totalRatePerSpad = Math.floor(totalRatePerSpad / spadCount)
            if (totalRatePerSpad != 0) {
                let requiredSpads = Math.floor((TargetRate << 16) / totalRatePerSpad)
                if (requiredSpads > 0xFFFF || requiredSpads<0) { requiredSpads = 0xFFFF }
                writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, requiredSpads)
                return
            }
        }
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 0x8000)
    }

    function writeReg(reg: number, d: number): void {
        let buf = pins.createBuffer(3)
        buf.setNumber(NumberFormat.UInt16BE, 0, reg)
        buf.setNumber(NumberFormat.UInt8BE, 2, d)
        pins.i2cWriteBuffer(i2cAddr, buf, false)
    }

    function writeReg16Bit(reg: number, d: number): void {
        let tmp = (reg << 16) | d
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
    }

    function writeReg32Bit(reg: number, d: number): void {
        let buf = pins.createBuffer(6)
        buf.setNumber(NumberFormat.UInt16BE, 0, reg)
        buf.setNumber(NumberFormat.UInt32BE, 2, d)
        pins.i2cWriteBuffer(i2cAddr, buf, false)
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8BE, false)
        return d
    }

    function readReg16Bit(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        return d
    }

    function readReg32Bit(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt32BE, false)
        return d
    }

    function encodeTimeout(timeout_mclks: number): number {
        let ls_byte = 0
        let ms_byte = 0
        if (timeout_mclks > 0) {
            ls_byte = timeout_mclks - 1
            while ((ls_byte & 0xFFFFFF00) > 0) {
                ls_byte >>= 1
                ms_byte++
            }
            return (ms_byte << 8) | (ls_byte & 0xFF)
        } else {
            return 0
        }
    }

    function timeoutMicrosecondsToMclks(timeout_us: number, macro_period_us: number): number {
        return Math.floor(((timeout_us << 12) + (macro_period_us >> 1)) / macro_period_us)
    }

    function calcMacroPeriod(vcsel_period: number): number {
        let pll_period_us = Math.floor((0x01 << 30) / fast_osc_frequency)
        let vcsel_period_pclks = (vcsel_period + 1) << 1

        let macro_period_us = 2304 * pll_period_us
        macro_period_us >>= 6
        macro_period_us *= vcsel_period_pclks
        macro_period_us >>= 6
        return macro_period_us
    }

    function startTimeout(): void {
        timeout_start_ms = input.runningTime()
    }

    function checkTimeoutExpired(): boolean {
        return (io_timeout > 0) && ((input.runningTime() - timeout_start_ms) > io_timeout)
    }

    function dataReady(): boolean {
        return (readReg(GPIO__TIO_HV_STATUS) & 0x01) == 0
    }
}
