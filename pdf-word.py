from flask import Flask, request, send_file
from docx2pdf import convert as docx2pdf_convert
from pdf2docx import Converter
import tempfile, os

app = Flask(__name__)

@app.route('/convert', methods=['POST'])
def convert():
    file = request.files['file']
    conversion = request.form['conversion']

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        file.save(input_path)

        if conversion == 'word_to_pdf':
            output_path = os.path.join(tmpdir, file.filename.replace('.docx', '.pdf'))
            docx2pdf_convert(input_path, output_path)
        elif conversion == 'pdf_to_word':
            output_path = os.path.join(tmpdir, file.filename.replace('.pdf', '.docx'))
            cv = Converter(input_path)
            cv.convert(output_path, start=0, end=None)
            cv.close()
        else:
            return "Invalid conversion type", 400

        return send_file(output_path, as_attachment=True)

if __name__ == '__main__':
    app.run(port=5000)
