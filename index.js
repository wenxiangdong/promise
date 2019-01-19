const Promise = require("./simple");

new Promise((resolve, reject) => {
    console.log("first");
    setTimeout(() => {
        resolve("second");
    }, 1000);
}).then(res => {
    console.log(res);
    console.log("third");
    return new Promise((resolve) => {
        resolve("forth");
    })
}).then(res => {
    console.log(res);
})