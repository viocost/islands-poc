const { createLogger, format, transports,  } = require('winston');
const { colorize, combine, timestamp, label, printf, prettyPrint, json } = format;


const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        json(),
    ),

    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new transports.Console(),
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' })
    ]
});


logger.log({level: "info", message: "foo"});

logger.level = "error";


logger.log({level: "info", message: "fooOFFF"});
logger.log({level: "error", message: "foo"});