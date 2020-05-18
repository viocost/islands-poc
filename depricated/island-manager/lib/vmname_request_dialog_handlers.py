def set_handlers(ui):
    # Handlers
    def on_no():
        print("NO")

    def on_yes():
        if ui.vm_name_input.text():
            pass


    def on_input_change(text):
        ui.button_yes.setEnabled(not not text)

    # Setting handlers
    ui.button_no.clicked.connect(on_no)
    ui.button_yes.clicked.connect(on_yes)
    ui.vm_name_input.textChanged.connect(on_input_change)


