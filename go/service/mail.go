package service

import (
	"gopkg.in/gomail.v2"
	"github.com/sirupsen/logrus"
	"fmt"
)

type MailService struct {
	dialer *gomail.Dialer
	from   string
	logger *logrus.Logger
}

func NewMailService(host, username, password string, port int, secure bool) *MailService {
	dialer := gomail.NewDialer(host, port, username, password)
	dialer.TLSConfig = &tls.Config{InsecureSkipVerify: !secure}

	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	logger.WithField("host", host).Info("Set up email transporter")

	return &MailService{
		dialer: dialer,
		from:   fmt.Sprintf("Trygr System <%s>", username),
		logger: logger,
	}
}

func (m *MailService) SendNotification(to []string, plainText string) error {
	if len(to) == 0 {
		return nil
	}

	m.logger.WithField("recipients", to).Info("Trying to send email")

	message := gomail.NewMessage()
	message.SetHeader("From", m.from)
	message.SetHeader("To", to...)
	message.SetHeader("Subject", "Trygr Event Notification")
	message.SetBody("text/plain", plainText)

	err := m.dialer.DialAndSend(message)
	if err != nil {
		m.logger.WithError(err).Error("Failed to send email")
		return fmt.Errorf("failed to send email: %w", err)
	}

	m.logger.Info("Message sent successfully")
	return nil
}
