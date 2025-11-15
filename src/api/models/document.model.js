const { Schema } = require("mongoose");

class Document {
  static name = "Document";
  static collection = "documents";
  static IsStandardModel = true;

  static getSchema() {
    return {
      fileName: { type: String, required: true },
      storagePath: { type: String, required: true },
      documentType: {
        type: String,
        required: true,
        enum: [
          "VAT_INVOICE",
          "IMPORT_DECLARATION",
          "PURCHASE_LIST",
          "NPL_ORIGIN_CERT",
          "EXPORT_DECLARATION",
          "COMMERCIAL_INVOICE",
          "BILL_OF_LADING",
          "BOM",
        ],
      },
      note: { type: String, default: "" },
      ocrPages: [
        {
          page: { type: Number, required: true },
          ocrStoragePath: { type: String, required: true },
          mimeType: { type: String, default: "image/png" },
        },
      ],
      base64Content: { type: String },
      mimeType: { type: String },
      bundleId: { type: Schema.Types.ObjectId, ref: "Bundle", required: true },
      status: {
        type: String,
        required: true,
        enum: [
          "PENDING_REVIEW",
          "REJECTED",
          "OCR_PROCESSING",
          "OCR_COMPLETED",
          "ARCHIVED",
        ],
        default: "PENDING_REVIEW",
      },
      rejectionReason: String,
      ocrResult: { type: String, default: "" },
      needsGeminiDetection: { type: Boolean, default: false },
      isExcelFile: { type: Boolean, default: false },
      companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
        required: true,
      },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },

      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      approvedAt: Date,
    };
  }
}

module.exports = Document;
