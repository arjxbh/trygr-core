import bunyan from 'bunyan';
import bunyanFormat from 'bunyan-format';

type LogLevels = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const formatOut = bunyanFormat({ outputMode: 'short' });

// TODO: add stream to logging file

function getLogger(name: string, level?: LogLevels) {
    return bunyan.createLogger({
        name: name,
        stream: formatOut,
        level: level || 'debug', // TODO: make this configurable from env vars
    });
}


export { getLogger };
