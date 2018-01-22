var _ = require("lodash");
var express = require("express");
var bodyParser = require("body-parser");

var jwt = require('jsonwebtoken');
var passport = require("passport");
var passportJWT = require("passport-jwt");

var dateTime = require('node-datetime');
var dt = dateTime.create();

var today = dt.format('Y-m-d H:M:S');

// MySQL
const mysql = require('mysql');
var db_config = {
    host: "122.155.219.52",
    user: "backoffice",
    password: "g=up'.s,j",
    database: "seedsoft_system",
    insecureAuth: true,
    connectTimeout: 1000000,
    debug: false
};
var con;
function handleDisconnect() {
    con = mysql.createConnection(db_config);    // Recreate the connection, since
    // the old one cannot be reused.
    con.connect(function (err) {                // The server is either down
        if (err) {                              // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        } else {  console.log(today + '=>' + ' db connected...'); }           // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
    // If you're also serving http, display a 503 error.
    con.on('error', function (err) {
        // console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            console.log(today + '=>' + err.code);
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}
handleDisconnect();
//=================================


// JSON Web Token - Passport
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeader();
jwtOptions.secretOrKey = 'SeedsoftOffice';

var strategy = new JwtStrategy(jwtOptions, function (jwt_payload, next) {
    console.log('payload received', jwt_payload);
    con.query('SELECT * FROM administrator WHERE aID = ?', [jwt_payload.id],
            function (err, rows) {
                if (!err) {
                    // console.log('The solution is: ', rows);
                    if (rows.length > 0) {
                        next(null, rows);
                    } else {
                        next(null, false, {message: 'Incorrect password'});
                    }

                } else {
                    next(null, false);
                }
            }
    );
});
passport.use(strategy);
//============================


var app = express();
app.use(passport.initialize());

// parse application/x-www-form-urlencoded
// for easier testing with Postman or plain HTML forms
app.use(bodyParser.urlencoded({
    extended: true
}));

// parse application/json
app.use(bodyParser.json());


// Enable CORS from client-side
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Credentials");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});



app.get("/", function (req, res) {
    res.json({message: "Welcome API!"});
});

app.post("/login", function (req, res, next) {
	console.log(today + '=>' + ' post/login');
    if (req.body.username && req.body.password) {
        var username = req.body.username;
        var password = req.body.password;
    } else {
        res.status(401).json({message: "Error! empty data."});
        return next();
    }

    console.log(username, password);

    // MD5 Password
    var hash = require('crypto').createHash('md5').update(""+password).digest('hex');
    // var hash = crypto.createHash('md5').update(""+password).digest('hex');
    // console.log(username, hash);
    con.query('SELECT * FROM administrator WHERE username = ? AND password = ?', [username, hash],
            function (err, rows) {
                if (!err) {
                    // console.log(rows);
                    console.log('Login id: ', rows[0].aID);
                    var payload = {id: rows[0].aID};
                    var token = jwt.sign(payload, jwtOptions.secretOrKey);
                    res.json({message: "ok", token: token});
                } else {
                    res.status(401).json({message: "username or passwords did not match"});
                }
            }
    );
});



/* GET user jobs. */
app.get("/jobs", passport.authenticate('jwt', {session: false}), function (req, res) {
    console.log(today + '=>' + ' get/jobs');
    // console.log(req.user[0].aID);
    var queryString = 'SELECT detail_problem.*, status_jobs.statusname, status_jobs.statusicon, ';
    queryString += 'administrator.firstname, administrator.lastname, ';
    queryString += 'account.firstname AS firstname1, account.lastname AS lastname1, account.mailaddr AS email1, account.tel AS tel1, ';
    queryString += 'account_support.firstname AS firstname2, account_support.lastname AS lastname2, account_support.mailaddr AS email2, account_support.tel AS tel2 ';
    queryString += 'FROM detail_problem ';
    queryString += 'INNER JOIN administrator ON administrator.aID = detail_problem.owner ';
    queryString += 'INNER JOIN status_jobs ON status_jobs.statusid = detail_problem.`status` ';
    queryString += 'LEFT JOIN account ON account.username = detail_problem.user ';
    queryString += 'LEFT JOIN account_support ON account_support.id = detail_problem.user_support ';
    queryString += 'WHERE detail_problem.`status` = 11 ';
    queryString += 'AND detail_problem.status_problem = 0 ';
    queryString += 'AND detail_problem.onsite_by IN(0, ?)';
    queryString += 'ORDER BY onsite_meet ASC';

    var result = [];

    con.query(queryString, [req.user[0].aID], function (err, rows, fields) {
        if (err)
            throw err;
        // console.log(rows);
        if (!err) {
            for (var i in rows) {
                // console.log(rows[i].aID);
                var customer = null;
                var email = null;
                var user = rows[i].user;
                var user_support = rows[i].user_support;
                var title = rows[i].title;
                var onsite_status = rows[i].onsite_status;
                var onsite_meet = rows[i].onsite_meet;
                var status_problem = rows[i].status_problem;

                if ((user != '') && (user != null)) {
                        customer = rows[i].firstname1+' '+rows[i].lastname1;
                        email = rows[i].email1;
                        tel = rows[i].tel1;
                } else {
                    if ((user_support != '') && (user_support != null)) {
                        customer = rows[i].firstname2+' '+rows[i].lastname2;
                        email = rows[i].email2;
                        tel = rows[i].tel2;
                    } else {
                        customer = title;
                        email = '';
                        tel = '';
                    }
                }

                if (email == '-') { email = ''; }
                if (tel == '-') { tel = ''; }

                var onsite_status_text = 'NORMAL';
                switch(onsite_status) {
                    case 1:
                        onsite_status_text = 'URGENT';
                        break;
                    case 3:
                        onsite_status_text = 'CRITICAL';
                        break;
                    default:
                        onsite_status_text = 'NORMAL';
                }

                if (status_problem == 1) {
                    onsite_status_text = 'DONE';
                }

                result.push({
                    id: rows[i].id,
                    customer: customer,
                    customer_email: email,
                    customer_tel: tel,
                    title: title,
                    name: rows[i].firstname+' '+rows[i].lastname,
                    problem: rows[i].problem,
                    statusicon: 'http://backoffice.seedhotspot.com/stored/statusicon/'+rows[i].statusicon,
                    statusname: rows[i].statusname,
                    datetime: rows[i].datetime,
                    datetime_update: rows[i].datetime_update,
                    onsite_meet: onsite_meet,
                    onsite_status: onsite_status_text
                });
            }
            // res.status(200).json({message: "ok", rows: result});
        } else {
            res.status(401).json({message: "Error! query data."});
            return next();
        }
    });

    var queryString = 'SELECT detail_problem.*, status_jobs.statusname, status_jobs.statusicon, ';
    queryString += 'administrator.firstname, administrator.lastname, ';
    queryString += 'account.firstname AS firstname1, account.lastname AS lastname1, account.mailaddr AS email1, account.tel AS tel1, ';
    queryString += 'account_support.firstname AS firstname2, account_support.lastname AS lastname2, account_support.mailaddr AS email2, account_support.tel AS tel2 ';
    queryString += 'FROM detail_problem ';
    queryString += 'INNER JOIN administrator ON administrator.aID = detail_problem.owner ';
    queryString += 'INNER JOIN status_jobs ON status_jobs.statusid = detail_problem.`status` ';
    queryString += 'LEFT JOIN account ON account.username = detail_problem.user ';
    queryString += 'LEFT JOIN account_support ON account_support.id = detail_problem.user_support ';
    queryString += 'WHERE detail_problem.`status` = 11 ';
    queryString += 'AND datetime_update>= DATE_ADD(CURDATE(), INTERVAL -3 DAY) ';
    queryString += 'AND detail_problem.status_problem = 1 ';
    queryString += 'AND detail_problem.onsite_by IN(0, ?)';
    queryString += 'ORDER BY datetime_update DESC';
    var query = con.query(queryString, [req.user[0].aID], function (err, rows, fields) {
        //if (err)
        //    throw err;
        if (!err) {
            for (var i in rows) {
                var customer = null;
                var email = null;
                var user = rows[i].user;
                var user_support = rows[i].user_support;
                var title = rows[i].title;
                var onsite_status = rows[i].onsite_status;
                var onsite_meet = rows[i].onsite_meet;
                var status_problem = rows[i].status_problem;

                if ((user != '') && (user != null)) {
                        customer = rows[i].firstname1+' '+rows[i].lastname1;
                        email = rows[i].email1;
                        tel = rows[i].tel1;
                } else {
                    if ((user_support != '') && (user_support != null)) {
                        customer = rows[i].firstname2+' '+rows[i].lastname2;
                        email = rows[i].email2;
                        tel = rows[i].tel2;
                    } else {
                        customer = title;
                        email = '';
                        tel = '';
                    }
                }

                if (email == '-') { email = ''; }
                if (tel == '-') { tel = ''; }

                onsite_status_text = 'DONE';

                result.push({
                    id: rows[i].id,
                    customer: customer,
                    customer_email: email,
                    customer_tel: tel,
                    title: title,
                    name: rows[i].firstname+' '+rows[i].lastname,
                    problem: rows[i].problem,
                    statusicon: 'http://backoffice.seedhotspot.com/stored/statusicon/'+rows[i].statusicon,
                    statusname: rows[i].statusname,
                    datetime: rows[i].datetime,
                    datetime_update: rows[i].datetime_update,
                    onsite_meet: onsite_meet,
                    onsite_status: onsite_status_text
                });
            }
            res.status(200).json({message: "success", result: result});
        } else {
            res.status(401).json({message: "Error! query data."});
            return next();
        }
    });
});




/* PUT user jobs. */
app.post("/jobs", passport.authenticate('jwt', {session: false}), function (req, res, next) {
    console.log(today + '=>' + ' post/jobs');
    // console.log(req.user[0].aID);
    var owner = req.user[0].aID;
    if (req.body.id && req.body.problem && req.body.resolve) {
        var id = req.body.id;
        var problem = req.body.problem;
        var resolve = req.body.resolve;
    } else {
        res.status(401).json({message: "Error! empty data."});
        return next();
    }

    try {
        var today = dt.format('Y-m-d H:M:S');
        console.log(today);
        var queryString = "UPDATE detail_problem SET problem =? , resolve =?, datetime_update = ?, owner_edit = ?  WHERE id = ?";
        var query = con.query(queryString, [problem, resolve, today, owner, id], function (err, result) {
            //if (err)
            //    throw err;
            if (!err) {
                res.status(200).json({message: "success", result: result});
            } else {
                res.status(401).json({message: "Error! query data."});
                return next();
            }
        });
    } catch (e) {
        res.status(401).json({message: "Error! update data."});
        return next();
        // console.error(error);
        // throw e;
    }
});




/* PUT customer sign. */
app.post("/sign", passport.authenticate('jwt', {session: false}), function (req, res, next) {
    console.log(today + '=>' + ' post/sign');
    console.log(req.body.line);
    var owner = req.user[0].aID;
    if (req.body.id && req.body.sign_user) {
        var id = req.body.id;
        var sign_user = req.body.sign_user;
        var email = req.body.email;
        var tel = req.body.customer_tel;
        var line = req.body.line;
    } else {
        res.status(401).json({message: "Error! empty data."});
        return next();
    }

    try {
        var queryStringConfig = "SELECT * FROM configuration WHERE variable = 'support_text_email_customer_closejob' AND owner = 1";
        con.query(queryStringConfig,
                function (errConfig, rowsConfig) {
                    if (!errConfig) {
                        var msg = rowsConfig[0].value;
                        msg = msg.replace(/%id%/g, id);

                        var queryProblem = "SELECT detail_problem.user, detail_problem.user_support, ";
                            queryProblem += "account.id AS id1, ";
                            queryProblem += "account.mailaddr AS email1, ";
                            queryProblem += "account.tel AS tel1, ";
                            queryProblem += "account.line AS line1, ";
                            queryProblem += "account_support.id AS id2, ";
                            queryProblem += "account_support.mailaddr AS email2, ";
                            queryProblem += "account_support.tel AS tel2, ";
                            queryProblem += "account_support.line AS line2 ";
                            queryProblem += "FROM detail_problem ";
                            queryProblem += "LEFT JOIN account ON account.username = detail_problem.user ";
                            queryProblem += "LEFT JOIN account_support ON account_support.id = detail_problem.user_support ";
                            queryProblem += "WHERE detail_problem.id = ?";
                        con.query(queryProblem, [id],
                                function (errProblem, rowsProblem) {
                                    if (!errProblem) {
                                        var user = rowsProblem[0].user;
                                        var user_support = rowsProblem[0].user_support;
                                        var iduser = '';
                                        var user_email = '';
                                        var user_tel = ''
                                        var user_line = '';
                                        if ((user != '') && (user != null)) {
                                            iduser = rowsProblem[0].id1;
                                            user_email = rowsProblem[0].email1;
                                            user_tel = rowsProblem[0].tel1;
                                            user_line = rowsProblem[0].line1;
                                        } else {
                                            iduser = rowsProblem[0].id2;
                                            user_email = rowsProblem[0].email2;
                                            user_tel = rowsProblem[0].tel2;
                                            user_line = rowsProblem[0].line2;
                                        }

                                        if (email != '') {
                                            user_email = email;
                                        }

                                        if (tel != '') {
                                            user_tel = tel;
                                        }

                                        if (line != '') {
                                            user_line = line;
                                        }

                                        if ((user != '') && (user != null)) {
                                            var queryUpdateAccount = "UPDATE account SET mailaddr =?  WHERE id = ?";
                                        } else {
                                            var queryUpdateAccount = "UPDATE account_support SET mailaddr =? WHERE id = ?";
                                        }
                                        con.query(queryUpdateAccount, [user_email, iduser],
                                            function (errUpdateAccount, resultUpdateAccount) {
                                                 if (!errUpdateAccount) {
                                                    console.log('Update Account', queryUpdateAccount);
                                                 }
                                            }
                                        );
                                    }
                                }
                        );





                        var queryAdmin = "SELECT firstname, lastname, email FROM administrator WHERE aID =?";
                        con.query(queryAdmin, [owner],
                                function (errAdmin, rowsAdmin) {
                                    if (!errAdmin) {
                                        var admin_email = rowsAdmin[0].email;
                                        var admin_name = rowsAdmin[0].firstname + ' ' + rowsAdmin[0].lastname;

                                        // var mailer = require("nodemailer");
                                        // var smtp = {
                                        //     host: 'smtp.gmail.com', //set to your host name or ip
                                        //     port: 465, //25, 465, 587 depend on your
                                        //     secure: true, // use SSL
                                        //     auth: {
                                        //         user: 'supportmail@seed-soft.com', //user account
                                        //         pass: 'seedsoft' //user password
                                        //     }
                                        // };

                                        // var smtp = {
                                        //     host: 'smtp.gmail.com', //set to your host name or ip
                                        //     port: 465, //25, 465, 587 depend on your
                                        //     secure: true, // use SSL
                                        //     debug: true,
                                        //     auth: {
                                        //         user: 'itrustnetwork@gmail.com', //user account
                                        //         pass: 'qudmjuirvyrxxska' //user password
                                        //     }
                                        // };

                                        // var smtpTransport = mailer.createTransport(smtp);

                                        // var mail = {
                                        //     from: admin_email, //from email (option)
                                        //     sender: admin_name,
                                        //     replyTo: admin_email,
                                        //     to: 'chanadda@seed-soft.com', //to email (require)
                                        //     subject: "แจ้งสถานะปัญหาการใช้งาน", //subject
                                        //     html: msg, //email body
                                        // }

                                        // smtpTransport.sendMail(mail, function (error, response) {
                                        //     console.log(response);
                                        //     if (error) {
                                        //         //error handler
                                        //         console.error(error);
                                        //     } else {
                                        //         //success handler
                                        //         console.log('Send email success');
                                        //     }
                                        //     smtpTransport.close();
                                        // });


                                        var today = dt.format('Y-m-d H:M:S');
                                        var queryString = "UPDATE detail_problem SET sign_user =? , status_problem =?, email_closejob =?, datetime_update = ?, owner_edit = ?  WHERE id = ?";
                                        var query = con.query(queryString, [sign_user, 1, msg, today, owner, id],
                                                function (err, result) {
                                                    // console.log(rows);
                                                    if (!err) {
                                                        res.status(200).json({message: "ok", result: result});
                                                    } else {
                                                        res.status(401).json({message: "Error! query data."});
                                                        return next();
                                                    }
                                                }
                                        );

                                    } else {
                                        res.status(401).json({message: "Error! query admin data."});
                                        return next();
                                    }
                                }
                        );

                    } else {
                        res.status(401).json({message: "Error! query email message."});
                        return next();
                    }
                }
        );



    } catch (e) {
        res.status(401).json({message: "Error! update data."});
        return next();
        // console.error(error);
        // throw e;
    }
});



app.get("/secret", passport.authenticate('jwt', {session: false}), function (req, res) {
    res.json({message: "Success! You can not see this without a token"});
});

app.get("/secretDebug",
        function (req, res, next) {
            console.log(req.get('Authorization'));
            next();
        }, function (req, res) {
    res.json("debugging");
});

app.listen(3000, function () {
    console.log("API running");
});
