const { Schema } = require("mongoose");

class Bundle {
  static name = "Bundle";
  static collection = "bundles";
  static IsStandardModel = true;

  static getSchema() {
    return {
      bundleName: { type: String, required: true },
      status: {
        type: String,
        required: true,
        enum: [
          "PENDING_REVIEW",
          "REJECTED",
          "OCR_PROCESSING",
          "OCR_COMPLETED",
          "OCR_FAILED",
          "APPROVED",
          "ARCHIVED",
        ],
        default: "PENDING_REVIEW",
      },
      rejectionReason: String,
      reviewNotes: [
        {
          _id: false,
          by: { type: Schema.Types.ObjectId, ref: "User" },
          byUsername: String,
          byFullName: String,
          byEmail: String,
          action: String,
          note: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
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

module.exports = Bundle;
