import logging

import markdown2 as mkd
from PyQt5.QtWidgets import QDialog

from views.help_form.help_form import Ui_HelpForm
from lib.util import adjust_window_size
log = logging.getLogger(__name__)


class Helpform(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.ui = Ui_HelpForm()
        self.ui.setupUi(self)
        self.content = self.load_help_content()
        self.ui.browser.setText(self.content)
        adjust_window_size(self)

    def load_help_content(self):
        try:
            with open("docs/user_guide.md", "r") as fp:
                text = fp.read()
                style = """<style>
                ul{
                    list-style: none;
                    margin: 0px;
                
                }
                
                #wrapper{
                    margin: 50px;
                    
                    max-width: 600px;
                }
                
                h2 {
                    color: #1f3d6d 
                
                }
                
                li{
                    margin-bottom: 5px;
                    margin-left: -40px;
                }
                
                li > a {
                    color: #1f3d6d;
                    margin: 0;
                    
                }
                
                p {
                    font-size: 16px;
                    max-width: 600px;
                    text-align: justify;
                    line-height: 30px;
                    margin-bottom: 50px;
                    
                }
                </style>
                """
                md = mkd.markdown(text, extras=["toc"])
                res = "%s<div id='wrapper'><h2>Table of content</h2>%s\n<br><br><br><br><br>%s</div>" % (
                style, md.toc_html, str(md))
                log.debug(res)
                return res

        except Exception as e:
            msg = "Unable to load Use guide content: %s" % str(e)
            log.error(msg)
            return msg
