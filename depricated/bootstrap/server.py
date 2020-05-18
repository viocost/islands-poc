from flask import Flask, render_template, request, Response
import qbittorrentapi
from bootstrapper import Status, Bootstrapper

app = Flask(__name__)
app.config['DEBUG'] = True


bs = Bootstrapper()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/bootstrap", methods=['POST'])
def bootstrap():
    if bs is not None and bs.is_working():
        res = Response()
        return res, 102
    bs.bootstrap(request.json['magnet'])
    return " ".join(["OK", bs.token])

@app.route("/status")
def status():
    if bs is None:
        return "0 IDLE"
    else:
        return " ".join([bs.get_status(), bs.get_status_string()])


if __name__ == "__main__":
    app.run(host='localhost', port=4000)
