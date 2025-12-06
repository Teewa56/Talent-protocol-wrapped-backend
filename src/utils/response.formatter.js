const formatSuccess = (data, message = 'Success') => {
    return {
        success: true,
        message,
        data
    };
};

// Format error response
const formatError = (message, error = null) => {
    return {
        success: false,
        message,
        ...(error && { error })
    };
};

module.exports = { formatSuccess, formatError };