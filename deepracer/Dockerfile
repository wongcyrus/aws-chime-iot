FROM python:3.7.2-stretch
COPY ./requirements.txt /app/requirements.txt
WORKDIR /app
RUN pip install -r requirements.txt
COPY . /app
COPY ./main.py /app/main.py
CMD python main.py
