var sensorPending = {};
var nextSensorRequest = 1;
var wiredSensorPlugin = null;
var sensorTimer = null;
var sensorSampling = false;

function sensorCall(method, id) {
    return new Promise(function (resolve) {
        var plugin = window.plugins && window.plugins.Sensorsdataprovider;
        if (!plugin || !plugin[method]) { resolve(null); return; }
        var requestId = nextSensorRequest++;
        sensorPending[requestId] = resolve;
        setTimeout(function () {
            if (sensorPending[requestId]) {
                delete sensorPending[requestId];
                resolve(null);
            }
        }, 4000);
        try { plugin[method](requestId, id); }
        catch (e) { delete sensorPending[requestId]; resolve(null); }
    });
}

function wireSensorPlugin() {
    var plugin = window.plugins && window.plugins.Sensorsdataprovider;
    if (!plugin || !plugin.asyncResponse || !plugin.asyncResponse.connect) return false;
    if (wiredSensorPlugin === plugin) return true;
    plugin.asyncResponse.connect(function (requestId, value) {
        var resolve = sensorPending[requestId];
        if (resolve) { delete sensorPending[requestId]; resolve(value); }
    });
    wiredSensorPlugin = plugin;
    return true;
}

function sampleSensors() {
    if (sensorSampling) return;
    var list = sensorList();
    if (!list.length) { renderSensors(); return; }
    sensorSampling = true;
    Promise.all(list.map(function (sensor) {
        return Promise.all([
            sensorCall("getSensorValue", sensor.sensorId),
            names[sensor.sensorId] ? Promise.resolve(names[sensor.sensorId]) : sensorCall("getSensorName", sensor.sensorId),
            units[sensor.sensorId] !== undefined ? Promise.resolve(units[sensor.sensorId]) : sensorCall("getSensorUnits", sensor.sensorId)
        ]).then(function (values) {
            var id = sensor.sensorId;
            if (values[1]) names[id] = String(values[1]);
            if (values[2] !== null && values[2] !== undefined) units[id] = String(values[2]);
            var value = Number(values[0]);
            if (!isFinite(value)) return;
            if (!series[id]) series[id] = [];
            series[id].push(value);
            if (series[id].length > HISTORY_POINTS) series[id].shift();
        });
    })).then(function () {
        persistHistory();
        renderSensors();
    }).catch(function () {
        renderSensors();
    }).then(function () {
        sensorSampling = false;
    });
}

function startSensorSampling() {
    if (sensorTimer) clearInterval(sensorTimer);
    var every = settings().intervalSec * 1000;
    sampleSensors();
    sensorTimer = setInterval(sampleSensors, every);
}

var restartSensors = rateLimit(startSensorSampling, 1500);
