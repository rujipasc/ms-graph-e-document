import dayjs from "dayjs";

const counters = {};

const getBatchNo = () => {
    const hour = dayjs().hour();
    if (hour < 6) return 1;
    if (hour < 12) return 2;
    if (hour < 18) return 3;
    return 4;
};

export const generatePdfFileName = (empID) => {
    const date = dayjs().format("YYYYMMDD");
    const batchNo = getBatchNo();
    const key = `${batchNo}_${empID}_${date}`;
    const hasCounter = counters[key] !== undefined;
    counters[key] = hasCounter ? counters[key] + 1 : 1;
    const running = String(counters[key]).padStart(4, "0");
    return `${batchNo}${empID}${date}-${running}.pdf`
};

export const resetCounters = () => {
    for (const key of Object.keys(counters)) {
        delete counters[key];
    }
};