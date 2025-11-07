const express = require("express")
const bodyParser = require('body-parser')
const app = express()
app.use(express.json())
// app.use(bodyParser)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// require
const predict = require('./routes/intent-route')


// usages
// app.use('/',(req,res)=>{
//     return  res.json({message:`this is the basic one`})
// })
app.use('/api',predict)
// webhook

const PORT = '3000'
app.listen(PORT || `3000`,()=>{
    console.log(`the server is running on port ${PORT}`)
})