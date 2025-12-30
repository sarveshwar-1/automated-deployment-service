const jwt = require('jsonwebtoken')

export const JWT_SECRET = "ILoveKiaraAdvani"

export function authMiddleware(req: any, res: any, next: any) {
  console.log("inside the auth middleware")
  const token = req.headers.token;
  const decodedUsername = jwt.verify(token, JWT_SECRET);
  if (decodedUsername.id) {
    //means that the token has been created by our JWT_SECRET 
    req.id = decodedUsername.id
    next();
  }
  else {
    res.status(401).json({
      "message": "Unauthorised request. sigin in and try again"
    })
  }
}
