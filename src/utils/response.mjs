class Response extends Error {
  constructor(success, message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.success = success;

    // Capture the stack trace for better debugging
    Error.captureStackTrace(this, this.constructor);
  }

  // Optional: Method to format the error response
  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
    };
  }
}

export default Response;
