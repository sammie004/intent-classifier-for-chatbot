const express = require("express")
const bodyParser = require('body-parser')
const app = express()
// app.use(bodyParser)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// require
const predict = require('./routes/intent-route')


// usages
// app.use('/',(req,res)=>{
//     return  res.json({message:`this is the basic one`})
// })
app.use('/api',predict)
const PORT = '3000'
app.listen(PORT || `3000`,()=>{
    console.log(`the server is running on port ${PORT}`)
})