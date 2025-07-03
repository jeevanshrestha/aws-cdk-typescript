exports.handler = async (event: any) => {
    const bucketName = process.env.BUCKET_NAME;
    console.log(`Using bucket: ${bucketName}`);
    
    // Your S3 operations here
    
    return {
        statusCode: 200,
        body: JSON.stringify('Success!'),
    };
};