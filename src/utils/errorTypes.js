export const ERROR_TYPES = {
    ZIP_PASSWORD: "ZipPassword",
    ZIP_CORRUPT: "ZipCorrupt",
    ZIP_NOT_FOUND: "ZipNotFound",
    FILENAME_INVALID: "FilenameInvalid",
    EMP_NOT_FOUND: "EmpNotFound",
    IMAGE_CONVERT: "ImageConvertError",
    PDF_MERGE: "PdfMergeError",
    SP_UPLOAD: "SharePointUploadError",
    SP_PATCH: "SharePointPatchError",
    UNKNOWN: "UnknownError",
}

export const classifyError = (err) => {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("password-protected") || msg.includes("encrypted"))
        return ERROR_TYPES.ZIP_PASSWORD;
    if (
        msg.includes("invalid zip") ||
        msg.includes("Central directory") ||
        msg.includes("unsupported compression")
    )
        return ERROR_TYPES.ZIP_CORRUPT;
    if (msg.includes("invalid zip file name") || msg.includes("unknown relocode"))
        return ERROR_TYPES.FILENAME_INVALID;
    if (msg.includes("employee not found")) return ERROR_TYPES.EMP_NOT_FOUND;
    if (msg.includes("image") && msg.includes("convert"))
        return ERROR_TYPES.IMAGE_CONVERT;
    if (msg.includes("pdf") && msg.includes("merge"))
        return ERROR_TYPES.PDF_MERGE;
    if (msg.includes("upload") && msg.includes("sharepoint"))
        return ERROR_TYPES.SP_UPLOAD;
    if (msg.includes("patch") && msg.includes("metadata"))
        return ERROR_TYPES.SP_PATCH;
    return ERROR_TYPES.UNKNOWN;
};