update favicon
remove the monthly calendar part, merge with agenda, make it inside the agenda, with a toggle to see the month
add a financial page to manage earnings from the appointments
add the possibility to mark the appointment as as done adding the amount received to the financial flow
add the possibility of mark the appointment as canceled (not the same exclude part we already have)
add the possibility to override the amount received when marking the appointment as done (keep the reference value that it should be), add the payment type, Cartao, Pix, Nenhum possibility of payment in multiple types and installments
Create a paymentMethods in strapi, to add Pix, Dinheito e Cartao
show the procedure on the Editar agendamento as well, not only the title
add cost of the services (should be decimal as the price) on the services on strapi to be able to calculate profit
add possibility in strapi to create a promotion to the service, a timely duration and the original value and promocional value (at the end of the promotion, it goes back to the original value or, became inactive after, it depends of a field selection) (same to a normal service, not only to combos) (prefer to use the unpublish or something like that on the strapi, instead of creating a isActive field)
for the promotion add a selector for the valid payment types (maybe the promotion will be valid only for one payment type)
add some charts to the financial page
for the unavailable dates, add the possibility to select many days, put the same reason and confirm
add an override hours for some days as well, similar to the unavailable dates, but for hours insted, I can register for that day an specific hour that dont afect the recurring one
change agendamento.ics to Agendamento.ics
add the (aceitamos pagamentos em pix, dinheiro, cartao) on the footer (should be editable on the strapi)
for the service in promotion, we need to add some special effects on it, to say that is in promotion for limited time and expires x day and from x to y price


possibility of syncing the agenda on the admin google calendar?
for the whatsapp confirmation, expect a reply from the user with yes or no to mark the appointment as confirmed, if the user replies no, mark it as canceled
