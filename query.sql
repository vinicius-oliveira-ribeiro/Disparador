CREATE TABLE public.envio_de_email (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    create_date TIMESTAMP NOT NULL,
    modified_date TIMESTAMP NOT NULL
); 


CREATE TABLE IF NOT EXISTS public.destinatarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  espaco_ocupado_GB text, -- Use o tipo de dados apropriado para armazenar a quantidade de espaço ocupado em GB
  data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Coluna para armazenar a data de envio do email
);

CREATE TABLE IF NOT EXISTS public.app_control (
  id SERIAL PRIMARY KEY,
  app_name VARCHAR(255) NOT NULL,
  last_execution TIMESTAMP,
  next_execution TIMESTAMP,
  cron VARCHAR(50), -- Coluna para armazenar a configuração do cron
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE public.error_log (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL
);

ALTER TABLE public.app_control
ALTER COLUMN next_execution TYPE VARCHAR(255);

INSERT INTO public.app_control (app_name, next_execution, cron, created_at, updated_at)
VALUES ('disparador_de_email', '2023-07-07T15:54:00', '* * * * *',NOW(), NOW());

--create database do controle de emails usado no python
CREATE TABLE IF NOT EXISTS public.emails (subject TEXT, date TIMESTAMP)