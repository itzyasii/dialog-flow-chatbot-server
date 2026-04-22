class errorResponse extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.data = data;

    // Capture the stack trace for better debugging
    Error.captureStackTrace(this, this.constructor);
  }


  // Optional: Method to format the error response
  toJSON() {
    return {
      success: false,
      status: this.status,
      message: this.message,
      data: this.data,
    };
  }
}

export default errorResponse;
