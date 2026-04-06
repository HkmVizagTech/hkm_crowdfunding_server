const response = (res, statusCode, message, data = null) => {
  if (!res) {
    return console.log("response is required");
  }

  const resObj = {
    success: statusCode < 400,
    statusCode,
    message,
    ...(data !== null ? { data } : {}),
  };

  return res.status(statusCode).json(resObj);
};

export default response