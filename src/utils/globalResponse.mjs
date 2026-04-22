export const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
  });
};

export const sendError = (res, err) => {
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: err.data || {},
  });
};
